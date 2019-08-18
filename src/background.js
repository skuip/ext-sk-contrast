/**
 * Send captured screen as message to the tab and inject content_script if needed
 */
function handleCapture(tab, dataUrl) {
	chrome.tabs.sendMessage(tab.id, { dataUrl }, function (response) {
		if (response === `OK`) return console.log(tab.id, `Message received`);
		// Message fails first time, since script isn`t yet injected.
		if (chrome.runtime.lastError) {
			console.log(tab.id, `Injecting content_script.js`);
			chrome.tabs.executeScript(tab.id, {file: `content_script.js`}, function (response) {
				if (response[0] !== `OK`) {
					return console.warn(tab.id, `Unexpected script response`, response);
				}
				chrome.tabs.sendMessage(tab.id, { dataUrl }, function (response) {
					if (response === `OK`) return console.log(tab.id, `Message received`);
					console.warn(tab.id, `Unexpected message response`);
				});
			});
		}
	});
}

/**
 * Capture viewport
 */
function handleBrowserActionClicked(tab) {
	chrome.tabs.captureVisibleTab(null, { format: `png` }, dataUri => handleCapture(tab, dataUri));
}

chrome.browserAction.onClicked.addListener(handleBrowserActionClicked);
