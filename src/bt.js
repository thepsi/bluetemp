let WEATHER_SERVICE = '74e7fe00-c6a4-11e2-b7a9-0002a5d5c51b';
let BATTERY_SERVICE = 'battery_service';
let BATTERY_LEVEL = "battery_level";
let COMMAND = '74e78e03-c6a4-11e2-b7a9-0002a5d5c51b';
let LOGGER_DATA = '74e78e04-c6a4-11e2-b7a9-0002a5d5c51b';
let INDOOR_AND_CH1_TO_3_TH_DATA = '74e78e10-c6a4-11e2-b7a9-0002a5d5c51b';
let CH_4_TO_7_TH_DATA = '74e78e14-c6a4-11e2-b7a9-0002a5d5c51b';
let PRESSURE_DATA = '74e78e20-c6a4-11e2-b7a9-0002a5d5c51b';
let TYPE_0 = 0x01;

export const sensorNames = [
	'Base station',
	'Channel 1',
	'Channel 2',
	'Channel 3',
	'Channel 4',
	'Channel 5',
];

// getTemp parses and returns the temperature at a given offset in the supplied
// DataView.
var getTemp = function(v, offset) {
	let t = v.getInt16(offset, true);
	if (t === 32767) {
		return null;
	}
	return t / 10;
};

// getHumidity parses and returns the humidity at a given offset in the
// supplied DataView.
var getHumidity = function(v, offset) {
	let val = v.getUint8(offset);
	if (val === 127) {
		return null;
	}
	return val;
};

function makeReading(name, temperature, humidity) {
	return { name, temperature, humidity };
}

export function BluetoothClient() {
	this.gatt_ = null;
	this.characteristics_ = {};
	this.dataHandler_ = null;
	this.currentReadingPromises_ = [];
	this.currentReadingResolves_ = [];
	for (let i = 0; i < sensorNames.length; i++) {
		this.currentReadingPromises_.push(new Promise((resolve, reject) => {
			this.currentReadingResolves_.push(resolve);
		}));
	}
	this.readyForCommandsPromise_ = new Promise((resolve, reject) => {
		this.readyForCommandsResolve_ = resolve;
	});
}

BluetoothClient.prototype.handleCharacteristicChanged_ = function(e) {
	let c = e.target;
	let v = c.value;
	if (c.uuid === INDOOR_AND_CH1_TO_3_TH_DATA) {
		let type = v.getUint8(0);
		if (type === TYPE_0) {
			this.currentReadingResolves_[0](makeReading(sensorNames[0], getTemp(v, 1), getHumidity(v, 9)));
			this.currentReadingResolves_[1](makeReading(sensorNames[1], getTemp(v, 3), getHumidity(v, 10)));
			this.currentReadingResolves_[2](makeReading(sensorNames[2], getTemp(v, 5), getHumidity(v, 11)));
			this.currentReadingResolves_[3](makeReading(sensorNames[3], getTemp(v, 7), getHumidity(v, 12)));
		}
	} else if(c.uuid === CH_4_TO_7_TH_DATA) {
		let type = v.getUint8(0);
		if (type === TYPE_0) {
			this.currentReadingResolves_[4](makeReading(sensorNames[4], getTemp(v, 1), getHumidity(v, 9)));
			this.currentReadingResolves_[5](makeReading(sensorNames[5], getTemp(v, 3), getHumidity(v, 10)));
		}
	} else if (c.uuid === PRESSURE_DATA) {
		// Experimentally the device seems to ignore our request for history if
		// we don't wait for this notification. I may have got this wrong - might
		// need to wait for *all* initial notifications (including battery?) or
		// (*sigh*) add a sleep() somewhere.
		console.log("Device is ready for commands");
		this.readyForCommandsResolve_();
	} else if (c.uuid === LOGGER_DATA) {
		if (this.dataHandler_ === null) {
			// nobody has registered to receive these; likely a bug or very late data
			return;
		}
		let hour = 1-v.getUint8(1);
		this.dataHandler_({ hourOffset: hour, temperature: getTemp(v, 2) });
		this.dataHandler_({ hourOffset: hour - 1, temperature: getTemp(v, 5) });
		this.dataHandler_({ hourOffset: hour - 2, temperature: getTemp(v, 8) });
		this.dataHandler_({ hourOffset: hour - 3, temperature: getTemp(v, 11) });
		this.dataHandler_({ hourOffset: hour - 4, temperature: getTemp(v, 14) });
	}
};

// connect connects to the device and registers to receive notifications for
// all characteristics of the weather and battery services.
BluetoothClient.prototype.connect = function() {
	let options = {
		filters: [{'services': [WEATHER_SERVICE]}],
		optionalServices: [BATTERY_SERVICE],
	};
	return navigator.bluetooth.requestDevice(options)
	.then(d => {
		return d.gatt.connect();
	})
	.then(server => {
		this.gatt_ = server;
		// Connect to battery service.
		let batteryPromise = this.gatt_.getPrimaryService(BATTERY_SERVICE)
		.then(s => s.getCharacteristic(BATTERY_LEVEL))
		.then(c => c.startNotifications())
		.then(c => c.addEventListener('characteristicvaluechanged', e => this.handleCharacteristicChanged_(e)));
		// Connect to weather service.
		let weatherPromise = this.gatt_.getPrimaryService(WEATHER_SERVICE)
		.then(s => s.getCharacteristics())
		.then(c => {
			let promises = [];
			c.forEach(c => {
				if (c.properties.indicate || c.properties.notify) {
					this.characteristics_[c.uuid] = c;
					promises.push(
						c.startNotifications()
						.then(c => c.addEventListener('characteristicvaluechanged', e => this.handleCharacteristicChanged_(e))));
				}
			});
			return Promise.all(promises);
		});
		return Promise.all([batteryPromise, weatherPromise]);
	});
};

// fetchCurrentReadings returns a promise resolving to a list of readings (in
// the form returned by makeReading).
BluetoothClient.prototype.fetchCurrentReadings = function() {
	return Promise.all(this.currentReadingPromises_);
};

// promiseTimeout returns a promise that rejects after a period of time.
function promiseTimeout(ms) {
	return new Promise((resolve, reject) => {
		let id = setTimeout(() => {
			clearTimeout(id);
			reject('Timed out in ' + ms + 'ms');
		}, ms);
	});
}

// fetchHistory returns a promise resolving to a list of historical data points
// for the given channel index.
BluetoothClient.prototype.fetchHistory = function(channel) {
	var dataResolve = null;
	const dataPromise = new Promise((resolve, reject) => {
		dataResolve = resolve;
	});
	const data = [];
	const expectedPoints = 170;
	this.dataHandler_ = point => {
		data.push(point);
		//console.log("Got point:", point, "total:", data.length);
		if (data.length >= expectedPoints) {
			dataResolve();
		}
	};
	return this.readyForCommandsPromise_
	.then(() => {
		console.log("Requesting history for channel:", channel);
		if (channel > 0) {
			channel += 15;
		}
		const v = Int8Array.of(-127, channel, -1);
		return this.characteristics_[COMMAND].writeValue(v);
	})
	// sometimes the device sends partial data; just do what we can
	.then(() => Promise.race([dataPromise, promiseTimeout(10000)]))
	.catch(e => console.log("Failed:", e, "; got", data.length, "of the expected", expectedPoints, "points"))
	.then(() => {
		this.dataHandler_ = null;
		return data;
	});
};

// disconnect disconnects from the GATT server.
BluetoothClient.prototype.disconnect = function() {
	this.characteristics_ = {};
	this.gatt_.disconnect();
	this.gatt_ = null;
};
