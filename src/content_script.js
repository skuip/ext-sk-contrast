(function() {
	let div;

	// Element id`s in the template
	const elements = {
		aaLarge: null, aaNormal: null, aaaLarge: null, aaaNormal: null, bgHex:
		null, bgSample: null, canvas: null, contrast: null, fgHex: null,
		fgSample: null, image: null, selection: null, stats: null
	};

	const state = {
		bgColor: ``,
		fgColor: ``,
		ratio: 0,
		x1: -1,
		x2: 0,
		y1: 0,
		y2: 0,
		zoom: 1
	};

	function handleOnMessage (data, sender, sendResponse) {
		sendResponse(`OK`);

		// Clear all previous stuff. If active return immediately
		if (clearAll()) return;

		const doc = document.documentElement;

		// Create "root" element.
		div = document.createElement(`div`);
		div.attachShadow({ mode: `open` });
		div.shadowRoot.addEventListener(`mousedown`, handleDragStart);
		div.shadowRoot.innerHTML = data.html;

		// Get the element instances
		Object.keys(elements).forEach(id => {
			elements[id] = div.shadowRoot.getElementById(id);
		});

		elements.image.src = data.dataUri;

		state.zoom = data.zoom;

		doc.appendChild(div);

		document.addEventListener(`keyup`, handleEscape);
		document.addEventListener(`scroll`, handleScroll);
		document.addEventListener(`resize`, handleScroll);
	}

	function handleEscape(event) {
		if (event.keyCode !== 27) return;
		clearAll();
	}

	function handleScroll() {
		clearAll();
	}

	function clearMeasurement() {
		if (!div) return;

		state.left = -1;
		state.ratio = 0;
	}

	function clearAll() {
		let active = false;

		document.removeEventListener(`keyup`, handleEscape);
		document.removeEventListener(`scroll`, handleScroll);
		document.removeEventListener(`resize`, handleScroll);

		if (div) {
			clearMeasurement();
			document.documentElement.removeChild(div);
			div = null;
		}

		// Release elements
		Object.keys(elements).forEach(id => {
			elements[id] = null;
		});

		return active;
	}

	function handleDragStart(event) {
		// No modifier keys
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
		// Only left button
		if (event.button !== 0) return;

		event.preventDefault();

		clearMeasurement();

		state.x1 = event.clientX;
		state.y1 = event.clientY;

		div.shadowRoot.addEventListener(`mousemove`, handleDragMove);
		div.shadowRoot.addEventListener(`mouseup`, handleDragStop);
	}

	function handleDragMove(event) {
		state.x2 = event.clientX;
		state.y2 = event.clientY;

		render();
	}

	function handleDragStop(event) {
		event.preventDefault();

		const { canvas, image, selection } = elements;

		div.shadowRoot.removeEventListener(`mousemove`, handleDragMove);
		div.shadowRoot.removeEventListener(`mouseup`, handleDragStop);

		const dpr = image.naturalWidth / image.width;

		const style = selection.style;
		const height = parseInt(style.height, 10) * dpr;
		const left   = parseInt(style.left, 10) * dpr;
		const top    = parseInt(style.top, 10) * dpr;
		const width  = parseInt(style.width, 10) * dpr;

		if (!height || !width) return clearMeasurement();

		// Resize canvas element to the right size.
		canvas.height = height;
		canvas.width = width;

		// Copy over the rectangle
		const ctx = canvas.getContext(`2d`);
		ctx.drawImage(image, left, top, width, height, 0, 0, width, height);

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
		const luminosity = list.map(item => ({ ...item, luminosity: calculateLuminosity(item.color) }));

		// Order array on luminosity
		luminosity.sort((a, b) => a.luminosity - b.luminosity);

		// Get the extremes
		const max = luminosity[0];
		const min = luminosity[luminosity.length - 1];

		// Background is the one with the most occurrences
		const background = min.count > max.count ? min : max;
		// Foreground is the other one
		const foreground = min.count > max.count ? max : min;

		// Store measurement
		state.bgColor = `#` + rgb2hex(background.color);
		state.fgColor = `#` + rgb2hex(foreground.color);
		state.ratio = calculateRatio(min.luminosity, max.luminosity);

		render();
	}

	function render() {
		const {
			aaLarge, aaNormal, aaaLarge, aaaNormal, bgHex, bgSample,
			contrast, fgHex, fgSample, selection, stats
		} = elements;

		const { bgColor, fgColor, ratio, x1, x2, y1, y2, zoom } = state;

		// Position selection window
		const style = selection.style;
		selection.classList.toggle(`is-visiable`, x1 >= 0);
		if (x1 >= 0) {
			const left   = Math.min(x1, x2);
			const top    = Math.min(y1, y2);

			const height = Math.max(y1, y2) - top;
			const width  = Math.max(x1, x2) - left;

			style.height = height + `px`;
			style.width  = width + `px`;
			style.top    = top + `px`;
			style.left   = left + `px`;
		}

		// Fill in the stats on measurement
		stats.classList.toggle(`is-visible`, ratio > 0);
		if (ratio > 0) {
			stats.style.zoom = 1 / zoom;
			aaLarge.classList.toggle(`pass`, ratio>3.0);
			aaNormal.classList.toggle(`pass`, ratio>4.5);
			aaaLarge.classList.toggle(`pass`, ratio>4.5);
			aaaNormal.classList.toggle(`pass`, ratio>7.0);
			bgHex.innerText = bgColor;
			bgSample.style.background = bgColor;
			contrast.innerText = ratio > 10 ? ratio.toFixed(4) : ratio.toFixed(5);
			fgHex.innerHTML = fgColor;
			fgSample.style.background = fgColor;
		}
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
