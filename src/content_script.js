(function() {
	let canvas, dataUrl, div, img, span, stats, style;

	function handleOnMessage (data, sender, sendResponse) {
		sendResponse(`OK`);

		// Clear all previous stuff. If active return immediately
		if (clearAll()) return;

		const doc = document.documentElement;

		dataUrl = data.dataUrl;

		style = document.createElement(`style`);
		style.textContent = `
			#sk-contrast {
				align-items: center;
				background: black;
				box-sizing: border-box;
				color: white;
				display:flex;
				font: normal normal 16px/1.5 monospace;
				height: 100vh;
				justify-content: center;
				left: 0;
				min-height: 100vh;
				min-width: 100vw;
				position: fixed;
				top: 0;
				width: 100vw;
				z-index: 9999;
			}
			#sk-contrast * {
				background: none;
				border: 0;
				color: inherit;
				font: inherit;
				margin: 0;
				padding: 0;
				z-index: 0;
			}
			#sk-canvas {
				height: auto;
				image-rendering: pixelated;
				margin-top: 16px;
				height: 228px;
				width: 304px;
				object-fit: contain;
			}
			#sk-color {
				border-radius: 50%;
				border: 1px solid white;
				display: inline-block;
				height: 1em;
				vertical-align: -2px;
				width: 1em;
			}
			#sk-image {
				cursor: crosshair;
				height: 100vh;
				left: 0;
				outline-offset: -2px;
				outline: 2px dashed #F00;
				position: absolute;
				top: 0;
				width: 100vw;
			}
			#sk-stats {
				background-color: #000D;
				outline: 4px solid #8888;
				color: white;
				flex: 0 0 auto;
				padding: 4px 8px;
				position: absolute;
				white-space: nowrap;
			}
			#sk-stats h1 {
				font: bold normal 24px/1.5 monospace;
			}
			#sk-stats h2 {
				font: bold normal 20px/1.5 monospace;
			}
			#sk-stats div {
				white-space: pre;
			}
			#sk-stats table {
				border-collapse: collapse;
				font: bold normal 24px/1 monospace;
			}
			#sk-stats td, #sk-stats th {
				border-left: 1px dashed white;
				border-top: 1px dashed white;
				padding: 2px 4px;
				text-align: left;
			}

			#sk-stats th:first-child {
				border-left: 0;
				border-right: 1px solid white;
				font-size: 14px;
				font-weight: normal;
				padding-left: 0;
			}
			#sk-stats tr:first-child th {
				border-bottom: 1px solid white;
				border-top: 0;
				font-size: 14px;
				font-weight: normal;
			}
			#sk-window {
				background-color: #8888;
				border: 1px solid black;
				outline-offset: -1px;
				outline: 1px dashed white;
				pointer-events: none;
				position: absolute;
			}

			#sk-fail {
				color: #f66;
			}
			#sk-pass {
				color: #6f6;
			}
		`;
		document.querySelector(`head`).appendChild(style);

		img = document.createElement(`img`);
		img.id = `sk-image`;
		img.src = dataUrl;

		div = document.createElement(`div`);
		document.addEventListener(`keyup`, handleEscape);
		document.addEventListener(`scroll`, handleScroll);
		document.addEventListener(`resize`, handleScroll);
		div.addEventListener(`mousedown`, handleDragStart);
		div.appendChild(img);
		div.id = `sk-contrast`;

		doc.appendChild(div);
	}

	function handleEscape(event) {
		if (event.keyCode !== 27) return;
		clearAll();
	}

	function handleScroll() {
		clearAll();
	}

	function clearMeasurement() {
		if (div) {
			if (stats) {
				if (canvas) {
					stats.removeChild(canvas);
					canvas = null
				}
				div.removeChild(stats);
				stats = null;
			}
			if (span) {
				div.removeChild(span);
				span = null;
			}
		}
	}

	function clearAll() {
		let active = false;

		document.removeEventListener(`keyup`, handleEscape);
		document.removeEventListener(`scroll`, handleScroll);
		document.removeEventListener(`resize`, handleScroll);

		if (style) {
			document.querySelector(`head`).removeChild(style);
			style = null;
		}
		if (div) {
			div.removeEventListener(`mousedown`, handleDragStart);
			div.removeEventListener(`mousemove`, handleDragMove);
			div.removeEventListener(`mouseup`, handleDragStop);

			clearMeasurement();

			if (img) {
				active = true;
				div.removeChild(img);
				img = null;
			}
			document.documentElement.removeChild(div);

			div = null;
		}

		return active;
	}

	function handleDragStart(event) {
		if (event.altKey) return;
		if (event.button !== 0) return;
		if (event.ctrlKey) return;
		if (event.metaKey) return;
		if (event.shiftKey) return;

		event.preventDefault();

		clearMeasurement();

		if (!span) span = document.createElement(`div`);
		span.id = `sk-window`;
		span.dataset.x = event.clientX;
		span.dataset.y = event.clientY;
		div.appendChild(span);

		div.addEventListener(`mousemove`, handleDragMove);
		div.addEventListener(`mouseup`, handleDragStop);
	}

	function handleDragMove(event) {
		const left   = Math.min(event.clientX, span.dataset.x);
		const top    = Math.min(event.clientY, span.dataset.y);
		const width  = Math.max(event.clientX, span.dataset.x) - left;
		const height = Math.max(event.clientY, span.dataset.y) - top;

		span.style.height = height + `px`;
		span.style.width  = width + `px`;
		span.style.top    = top + `px`;
		span.style.left   = left + `px`;
	}

	function handleDragStop(event) {
		event.preventDefault();

		div.removeEventListener(`mousemove`, handleDragMove);
		div.removeEventListener(`mouseup`, handleDragStop);

		const dpr = img.naturalWidth / img.width;

		const height = parseInt(span.style.height, 10) * dpr;
		const left = parseInt(span.style.left, 10) * dpr;
		const top = parseInt(span.style.top, 10) * dpr;
		const width = parseInt(span.style.width, 10) * dpr;

		if (!height || !width) return clearMeasurement();

		// Create canvas element of the right size.
		if (!canvas) canvas = document.createElement(`canvas`);
		canvas.height = height;
		canvas.id = `sk-canvas`;
		canvas.width = width;

		// Copy over the rectangle
		const ctx = canvas.getContext(`2d`);
		ctx.drawImage(img, left, top, width, height, 0, 0, width, height);

		// Get raw image data
		const data = ctx.getImageData(0,0,width,height).data;

		// Get all unique colors.
		const colors = {};
		for (let i = 0; i < data.length; i += 4) {
			const rgb = (data[i]<<16) | (data[i+1]<<8) | (data[i+2]<<0);
			if (!colors[rgb]) colors[rgb] = 0;
			colors[rgb]++;
		}

		// Convert from object to array
		let list = Object.keys(colors).map(key => ({ color: +key, count: colors[key] }));

		const threshold = Math.floor(width * height / 1000);
		if (threshold >= 1) {
			list = list.filter(item => item.count > threshold);
		}

		// Calculate luminosity for each color
		const contrast = list.map(item => ({ ...item, luminosity: calculateLuminosity(item.color) }));

		// Order array on luminosity
		contrast.sort((a, b) => a.luminosity - b.luminosity);

		// Get the extremes
		const max = contrast[0];
		const min = contrast[contrast.length - 1];

		// Background is the one with the most occurrences
		const background = min.count > max.count ? min : max;
		// Foreground is the other one
		const foreground = min.count > max.count ? max : min;

		// Calculate the contrast ratio
		const ratio = calculateRatio(min.luminosity, max.luminosity);

		const fail = `<span id="sk-fail">Fail</span>`;
		const pass = `<span id="sk-pass">Pass</span>`;

		// Create display element with the gathered stats.
		if (!stats) stats = document.createElement(`div`);
		stats.id = `sk-stats`;
		stats.innerHTML = `
			<h1>Contrast</h1>
			<h2>Measurement</h2>
			<div>background = #${rgb2hex(background.color)} <span id="sk-color" style="background:#${rgb2hex(background.color)}"></span></div>
			<div>foreground = #${rgb2hex(foreground.color)} <span id="sk-color" style="background:#${rgb2hex(foreground.color)}"></span></div>
			<div>constrast  = ${ratio > 10 ? ratio.toFixed(4) : ratio.toFixed(5)} ${ratio >= 7 ? `AAA` : (ratio >= 4.5 ? `AA` : ``)}</div>
			<h2>Results</h2>
			<table>
				<th></th><th>Normal text</th><th>Large/Bold text</th></tr>
				<tr><th>WCAG  AA</th><td>${ratio>4.5 ? pass : fail}</td><td>${ratio>3.0 ? pass : fail}</td></tr>
				<tr><th>WCAG AAA</th><td>${ratio>7.0 ? pass : fail}</td><td>${ratio>4.5 ? pass : fail}</td></tr>
			</table>
		`;
		stats.appendChild(canvas);
		div.appendChild(stats);
	}

	function calculateRatio(l1, l2) {
		return l1 > l2 ? l1 / l2 : l2 / l1;
	}

	// https://github.com/gdkraus/wcag2-color-contrast
	function calculateLuminosity(rgb) {
		let r = ((rgb >> 16) & 255) / 255; // red value
		let g = ((rgb >>  8) & 255) / 255; // green value
		let b = ((rgb >>  0) & 255) / 255; // blue value

		if (r <= 0.03928) {
			r = r / 12.92;
		} else {
			r = Math.pow(((r + 0.055) / 1.055), 2.4);
		}

		if (g <= 0.03928) {
			g = g / 12.92;
		} else {
			g = Math.pow(((g + 0.055) / 1.055), 2.4);
		}

		if (b <= 0.03928) {
			b = b / 12.92;
		} else {
			b = Math.pow(((b + 0.055) / 1.055), 2.4);
		}

		let luminosity = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		return luminosity + 0.05;
	}

	/**
	 * Converts an RGB color value to HEX.
	 *
	 * @param   String  rgb     RGB 0xRRGGBB
	 * @return  Array           Hex "RRGGBB"
	 */
	function rgb2hex(rgb) {
		let hex = rgb.toString(16);
		if (hex.length < 6) hex = (`00000` + hex).substr(-6);
		return hex;
	}


	// Listen for messages from the background process.
	chrome.runtime.onMessage.addListener(handleOnMessage);
})();

`OK`;
