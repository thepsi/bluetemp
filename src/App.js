import React from 'react';
import './App.css';

import CurrentView from './CurrentView';
import HistoryView from './HistoryView';

import { AppBar, Box, Tab, Tabs, Typography } from '@material-ui/core';
import CssBaseline from '@material-ui/core/CssBaseline';

function TabPanel(props) {
	const { children, value, index } = props;
	return (
		<Typography component="div" role="tabpanel" hidden={value !== index}>
			{value === index && <Box>{children}</Box>}
		</Typography>
	);
}

function App() {
	const [value, setValue] = React.useState(0);
	const handleChange = (e, newValue) => {
		setValue(newValue);
	};
	return (
		<React.Fragment>
		  <CssBaseline />
			<div className="App">
				<AppBar position="static">
					<Tabs value={value} onChange={handleChange}>
				    <Tab label="Current" />
						<Tab label="History" />
					</Tabs>
				</AppBar>
				<TabPanel value={value} index={0}>
					<CurrentView />
				</TabPanel>
				<TabPanel value={value} index={1}>
					<HistoryView />
				</TabPanel>
			</div>
		</React.Fragment>
  );
}

export default App;
