import React from 'react';

import moment from 'moment';
import CircularProgress from '@material-ui/core/CircularProgress';
import { Line } from 'react-chartjs-2';
import { Button } from '@material-ui/core';

import { BluetoothClient, sensorNames } from './bt';

// fetchHistory fetches data for all channels.
async function fetchHistory(setStatusMessage, addDataset) {
	let c = new BluetoothClient();
	setStatusMessage("Connecting to device");
	await c.connect();
	for (let i = 0; i < sensorNames.length; i++) {
		setStatusMessage("Fetching data for sensor: " + sensorNames[i]);
		let data = await c.fetchHistory(i);
		addDataset(sensorNames[i], data);
	}
	setStatusMessage("Disconnecting");
	c.disconnect();
};

const colours = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33'];
const fillColours = ['#700e0f','#1b3e59','#285926','#4c2752','#803e00','#80801a'];

export default function HistoryView(props) {
	const [statusMessage, setStatusMessage] = React.useState("");
	const [data, setData] = React.useState({datasets: []});
	const handleClickFetch = e => {
		setStatusMessage("Initialising client library");
		let newDatasets = [];
		setData({datasets: newDatasets});
		const now = moment();
		const addDataset = (sensorName, points) => {
			const newData = [];
			points.forEach(p => {
				newData.push({x: now.clone().add(p.hourOffset, 'hours').startOf('hour'), y: p.temperature});
			});
			newDatasets.push({
				label: sensorName,
				data: newData,
				fill: false,
				pointRadius: 2,
				borderColor: colours[newDatasets.length % colours.length],
				backgroundColor: fillColours[newDatasets.length % colours.length],
				// TODO: investigate whether this is working properly
				spanGaps: false,
			});
			setData({datasets: newDatasets});
		};
		fetchHistory(setStatusMessage, addDataset)
		.then(() => {
			setStatusMessage("");
		});
	};
	const options = {
		scales: {
			xAxes: [{
				type: 'time',
				time: {
					unit: 'day',
				},
			}],
		},
	};
	return (
		<>
		<Button variant="contained" onClick={handleClickFetch}>Fetch last 7 days</Button>
		{statusMessage && <div><CircularProgress />{statusMessage}</div>}
		<Line options={options} data={data} />
		</>
	);
}
