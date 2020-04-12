import React from 'react';

import { Button } from '@material-ui/core';

import { BluetoothClient } from './bt';
import { TempTable, makeRow } from './TempTable';

async function fetchTemperatures() {
	let c = new BluetoothClient();
	await c.connect();
	let readings = await c.fetchCurrentReadings();
	let rows = [];
	readings.forEach(reading => {
		rows.push(makeRow(reading.name, reading.temperature, reading.humidity));
	});
	c.disconnect();
	return rows;
}

export default function CurrentView() {
	const [rows, setRows] = React.useState([
		makeRow('No data yet', null, null),
	]);
	const handleClickFetch = e => {
		setRows([
			makeRow('Loading...', 'spin', 'spin'),
		]);
		fetchTemperatures()
		.then(newRows => {
			setRows(newRows);
		})
		.catch(e => {
			setRows([
				makeRow('Error: ' + e, null, null),
			]);
		});
	};
	return (
		<>
			<Button variant="contained" onClick={handleClickFetch}>Fetch current readings</Button>
			<TempTable rows={rows} />
		</>
	);
}

