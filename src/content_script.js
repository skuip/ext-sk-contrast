(function() {
	let div;

	// Element id`s in the template
	const elements = {
		aaLarge: null, aaNormal: null, aaaLarge: null, aaaNormal: null, bgHex:
		null, bgSample: null, canvas: null, contrast: null, fgHex: null,
		fgSample: null, grid: null, image: null, selection: null, stats: null
	};

	const state = {
		bgColor: ``,
		fgColor: ``,
		luminosity: [],
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

		state.x1 = -1;
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
		render();

		state.x1 = event.clientX;
		state.y1 = event.clientY;
		state.luminosity = [];

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

		state.x2 = event.clientX;
		state.y2 = event.clientY;

		const { canvas, image } = elements;
		const { x1, x2, y1, y2 } = state;

		div.shadowRoot.removeEventListener(`mousemove`, handleDragMove);
		div.shadowRoot.removeEventListener(`mouseup`, handleDragStop);

		const dpr = image.naturalWidth / image.width;

		const left   = dpr * Math.min(x1, x2);
		const top    = dpr * Math.min(y1, y2);
		const height = dpr * Math.max(y1, y2) - top;
		const width  = dpr * Math.max(x1, x2) - left;

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
		const pixels = width * height / 100;
		let list = Object.keys(colors).map(key => ({
			color: +key,
			count: colors[key],
			percentage: colors[key] / pixels
		}));

		// Calculate luminosity for each color
		const luminosity = list.map(item => ({
			hex: rgb2hex(item.color).toUpperCase(),
			luminosity: calculateLuminosity(item.color),
			...item
		}));

		luminosity.sort((a, b) => b.count - a.count);

		for (let i = 0; i < luminosity.length - 1; i++) {
			if (luminosity[i].disabled) continue;
			for (let j = i + 1; j < luminosity.length; j++) {
				const d = distance(luminosity[i].color, luminosity[j].color);
				if (d < 0.1) luminosity[j].disabled = true;
			}
		}

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
		state.bgColor = `#` + rgb2hex(background.color).toUpperCase();
		state.fgColor = `#` + rgb2hex(foreground.color).toUpperCase();
		state.ratio = calculateRatio(min.luminosity, max.luminosity);
		state.luminosity = luminosity;

		render();
	}

	function render() {
		const {
			aaLarge, aaNormal, aaaLarge, aaaNormal, bgHex, bgSample,
			contrast, fgHex, fgSample, grid, selection, stats
		} = elements;

		const { bgColor, fgColor, luminosity, ratio, x1, x2, y1, y2, zoom } = state;

		// Position selection window
		const style = selection.style;
		selection.classList.toggle(`hidden`, x1 < 0);
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

		if (ratio <= 0) return;

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

		while (grid.firstElementChild) {
			grid.removeChild(grid.firstElementChild);
		}

		const colors = luminosity.filter(a => !a.disabled);
		colors.sort((a, b) => b.count - a.count);
		colors.splice(10);

		console.log(luminosity);
		console.log(colors);

		let hexes = `<tr><th></th>`
		let percs = `<tr><th></th>`
		for (let ix = 0; ix < colors.length; ix++) {
			const lx = colors[ix];

			let th = `<th class="`;
			if ( calculateRatio(lx.luminosity, 0.05) < calculateRatio(lx.luminosity, 1.05)) {
				th += `white`;
			} else {
				th += `black`;
			}
			th += `" style="background:#` + rgb2hex(lx.color) + `">`;

			hexes += th + `<span>` + rgb2hex(lx.color).toUpperCase() + `</span></th>`;
			percs += th + lx.percentage.toFixed(2).substr(0, 4) + `%</th>`;
		}
		hexes += `</tr>`;
		percs += `</tr>`;

		let html = hexes + percs;

		for (let iy = 1; iy < colors.length; iy++) {
			const ly = colors[iy];

			html += `<tr><th class="`
			if ( calculateRatio(ly.luminosity, 0.05) < calculateRatio(ly.luminosity, 1.05)) {
				html += `white`;
			} else {
				html += `black`;
			}
			html += `" style="background:#` + rgb2hex(ly.color) + `">` + rgb2hex(ly.color).toUpperCase();
			html += `</th>`;

			for (let ix = 0; ix < colors.length; ix++) {
				const lx = colors[ix];

				const ratio = calculateRatio(lx.luminosity, ly.luminosity);

				if (iy > ix) {
					html += `<td style="background:`;
					if (ratio < 3.0) {
						html += `#D00`;
					}
					else if (ratio < 4.5) {
						html += `#A50`;
					}
					else {
						html += `#070`;
					}
					// Don't round up 4.4999 to 4.5, it is just not the same
					html += `">` + (Math.floor(ratio * 100) / 100).toFixed(2) + `</td>`
				} else {
					html += `<td></td>`;
				}
			}

			html += `</tr>`;
		}

		grid.innerHTML = html;
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

	// https://github.com/gdkraus/wcag2-color-contrast
	function distance(rgb1, rgb2) {
		let r = (((rgb1 >> 16) & 255) / 255) - (((rgb2 >> 16) & 255) / 255);
		let g = (((rgb1 >>  8) & 255) / 255) - (((rgb2 >>  8) & 255) / 255);
		let b = (((rgb1 >>  0) & 255) / 255) - (((rgb2 >>  0) & 255) / 255);

		return Math.sqrt(r * r + g * g + b * b);
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
