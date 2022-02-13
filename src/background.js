/**
 * Send captured screen as message to the tab and inject content_script if needed
 */
function handleCapture({ dataUri, html, tab, zoom }) {
	const message = { dataUri, html, zoom };

	chrome.tabs.sendMessage(tab.id, message, function (response) {
		if (response === 'OK') return console.log(tab.id, 'Message received');
		// Message fails first time, since script isn't yet injected.
		if (chrome.runtime.lastError) {
			console.log({
				tab: tab.id,
				msg: 'Injecting content_script.js',
				response,
			});

			chrome.scripting.executeScript(
				{
					target: { tabId: tab.id },
					files: ['content_script.js'],
				},
				function (response) {
					console.log(response[0].result);
					if (response[0].result !== 'OK') {
						return console.warn({
							tab: tab.id,
							msg: 'Unexpected script response',
							response,
						});
					}
					chrome.tabs.sendMessage(tab.id, message, function (response) {
						if (response === 'OK') {
							return console.log({
								tab: tab.id,
								msg: 'Message received',
							});
						}

						console.warn({
							tab: tab.id,
							msg: 'Unexpected message response',
							response,
						});
					});
				}
			);
		}
	});
}

/**
 * Capture viewport
 */
function handleBrowserActionClicked(tab) {
	const url = chrome.runtime.getURL('shadow-root.html');

	// Determin current zoom level.
	chrome.tabs.getZoom(tab.id, function (zoom) {
		fetch(url)
			.then(function (response) {
				const text = response.text();
				return text;
			})
			.then(function (html) {
				chrome.tabs.captureVisibleTab(null, { format: 'png' }, function (dataUri) {
					console.log({ dataUri, html, tab, zoom });
					handleCapture({ dataUri, html, tab, zoom });
				});
			});
	});
}

chrome.action.onClicked.addListener(handleBrowserActionClicked);
