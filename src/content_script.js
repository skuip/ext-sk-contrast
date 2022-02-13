(function () {
	let div;

	// Element id's in the template
	const elements = {
		canvas: null,
		color1: null,
		color2: null,
		contrast: null,
		grid: null,
		image: null,
		ratio: null,
		selection: null,
		stats: null,
		xaxis1: null,
		xaxis2: null,
		yaxis1: null,
		yaxis2: null,
	};

	const colorNames = {
		0x007398: 'Petrol',
		0x009ece: 'Info',
		0x073973: 'Blue3',
		0x0c7dbb: 'Link blue',
		0x29a61b: 'Confirm',
		0x2e2e2e: 'Grey8',
		0x3679e0: 'Blue2',
		0x3c1276: 'Purple3',
		0x44c6f4: 'Info DRK',
		0x496e01: 'Green3',
		0x505050: 'Grey7',
		0x53565a: 'Dark<br/>gray',
		0x53b848: 'Confirm DRK',
		0x661cca: 'Purple2',
		0x737373: 'Grey6',
		0x8ed700: 'Green2',
		0x8e8e8e: 'Grey5',
		0x976500: 'Yellow3',
		0xa92b1d: 'Red3',
		0xacd2ff: 'Blue1',
		0xb9b9b9: 'Grey4',
		0xbb84ff: 'Purple1',
		0xc0f25d: 'Green1',
		0xc83727: 'Warning',
		0xcde4ff: 'Pale blue',
		0xdcdcdc: 'Grey3',
		0xdcdcdd: 'Cool grey',
		0xeb6500: 'A11Y Orange',
		0xebebeb: 'Grey2',
		0xf5f5f5: 'Grey1',
		0xf73e29: 'Red2',
		0xfdd300: 'Yellow2',
		0xfeb7b7: 'Red1',
		0xff6a5a: 'Warning DRK',
		0xff6c00: 'Primary orange',
		0xff8200: 'Orange DRK',
		0xffec84: 'Yellow1',
		0xfff0e4: 'Pale orange',
		0xffffff: 'White',
	};

	const state = {
		colors: [],
		minMax: [],
		drag: false,
		x1: -1,
		x2: 0,
		y1: 0,
		y2: 0,
		zoom: 1,
	};

	function handleOnMessage(data, sender, sendResponse) {
		sendResponse('OK');

		// Clear all previous stuff. If active return immediately
		if (clearAll()) return;

		const doc = document.documentElement;

		// Create "root" element.
		div = document.createElement('div');
		div.attachShadow({ mode: 'open' });
		div.shadowRoot.addEventListener('mousedown', handleDragStart);
		div.shadowRoot.addEventListener('mousemove', handleDragMove);
		div.shadowRoot.innerHTML = data.html;

		// Get the element instances
		Object.keys(elements).forEach((id) => {
			elements[id] = div.shadowRoot.getElementById(id);
		});

		elements.image.src = data.dataUri;

		state.zoom = data.zoom;

		doc.appendChild(div);

		document.addEventListener('keyup', handleEscape);
		document.addEventListener('scroll', handleScroll);
		document.addEventListener('resize', handleScroll);
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
		state.colors = [];
	}

	function clearAll() {
		let active = false;

		document.removeEventListener('keyup', handleEscape);
		document.removeEventListener('scroll', handleScroll);
		document.removeEventListener('resize', handleScroll);

		if (div) {
			clearMeasurement();
			document.documentElement.removeChild(div);
			div = null;
		}

		// Release elements
		Object.keys(elements).forEach((id) => {
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
		state.drag = true;
		state.colors = [];

		div.shadowRoot.addEventListener('mouseup', handleDragStop);
	}

	function handleDragMove(event) {
		if (state.drag) {
			state.x2 = event.clientX;
			state.y2 = event.clientY;
			render();
		}

		const { colors } = state;
		if (colors.length === 0) {
			const { xaxis2, yaxis2 } = elements;
			xaxis2.style.top = event.clientY + 'px';
			yaxis2.style.left = event.clientX + 'px';
		}
	}

	function handleDragStop(event) {
		event.preventDefault();

		state.x2 = event.clientX;
		state.y2 = event.clientY;
		state.drag = false;

		const { canvas, image } = elements;
		const { x1, x2, y1, y2 } = state;

		div.shadowRoot.removeEventListener('mouseup', handleDragStop);

		const dpr = image.naturalWidth / image.width;

		const left = dpr * Math.min(x1, x2);
		const top = dpr * Math.min(y1, y2);
		const height = dpr * Math.max(y1, y2) - top;
		const width = dpr * Math.max(x1, x2) - left;

		if (!height || !width) return clearMeasurement();

		// Resize canvas element to the right size.
		canvas.height = height;
		canvas.width = width;

		if (width / height > 600 / 228) {
			canvas.style.height = (600 * height) / width + 'px';
			canvas.style.width = '600px';
		} else {
			canvas.style.width = (228 * width) / height + 'px';
			canvas.style.height = '228px';
		}

		// Copy over the rectangle
		const ctx = canvas.getContext('2d');
		ctx.drawImage(image, left, top, width, height, 0, 0, width, height);

		// Get raw image data
		const data = ctx.getImageData(0, 0, width, height).data;
		const dataLength = data.length;

		// Get all unique colors.
		const colors = { 0: [0, 0] };
		let lastRgb = 0;
		let lastCnt = 0;

		// Scan vertically
		for (let x = 0; x < width * 4; x += 4) {
			for (let y = 0; y < dataLength; y += 4 * width) {
				const i = x + y;
				const rgb = (data[i] << 16) | (data[i + 1] << 8) | (data[i + 2] << 0);

				if (!colors[rgb]) colors[rgb] = [0, 0];
				colors[rgb][0]++;

				if (lastRgb != rgb) {
					if (colors[lastRgb][1] < lastCnt) colors[lastRgb][1] = lastCnt;
					lastCnt = 1;
					lastRgb = rgb;
				} else {
					lastCnt++;
				}
			}
		}

		// Rescan horizontally
		lastRgb = 0;
		lastCnt = 0;
		for (let y = 0; y < dataLength; y += 4 * width) {
			for (let x = 0; x < width * 4; x += 4) {
				const i = x + y;
				const rgb = (data[i] << 16) | (data[i + 1] << 8) | (data[i + 2] << 0);

				if (lastRgb != rgb) {
					if (colors[lastRgb][1] < lastCnt) colors[lastRgb][1] = lastCnt;
					lastCnt = 1;
					lastRgb = rgb;
				} else {
					lastCnt++;
				}
			}
		}

		// Convert from object to array
		const percentPixels = (width * height) / 100;

		let luminosity = Object.keys(colors).map((key) => {
			key = +key;
			const rgb = rgb2obj(key);

			let color = {
				hex: rgb2hex(key),
				count: colors[key][0],
				stripe: colors[key][1],
				name: colorNames[key] || '',
				color: key,
				luminosity: calculateLuminosity(key),
				percentage: colors[key][0] / percentPixels,
				...rgb,
			};

			return color;
		});

		// Order array on usage
		luminosity.sort((c1, c2) => {
			let r = c2.stripe - c1.stripe;
			if (r) return r;
			r = c2.count - c1.count;
			return r;
		});

		for (let i1 = 0; i1 < luminosity.length; i1++) {
			const c1 = luminosity[i1];

			for (let i2 = luminosity.length - 1; i2 > i1; i2--) {
				const c2 = luminosity[i2];

				if (isEuclideanDistance(c1, c2, 2)) {
					// Color are very close, move pixels over to the bigger one
					c1.count += c2.count;
					c2.count = 0;
					break;
				}
			}
		}

		// Get rid of single pixel colors
		luminosity = luminosity.filter((c1) => c1.count > 1 || c1.stripe > 1);

		// Find maximum contrast
		luminosity.sort((c1, c2) => c2.luminosity - c1.luminosity);
		state.minMax = [luminosity[0], luminosity[luminosity.length - 1]];

		// Order array on longest pattern
		luminosity.sort((c1, c2) => {
			let r = c2.stripe - c1.stripe;
			if (r) return r;
			r = c2.count - c1.count;
			return r;
		});

		//		luminosity = luminosity.reduce((acc, cur) => {
		//			if (acc.findIndex((item) => item.color === cur.color) === -1) {
		//				acc.push(cur);
		//			}
		//			return acc;
		//		}, []);
		//
		//		while (luminosity.length > 10) {
		//			let candidates = [];
		//			for (let i = luminosity.length - 1; i > 1; i--) {
		//				const c1 = luminosity[i - 2];
		//				const c2 = luminosity[i - 1];
		//				const c3 = luminosity[i - 0];
		//				const distance1 = calcEuclideanDistance(c1, c2);
		//				const distance2 = calcEuclideanDistance(c2, c3);
		//
		//				if (c1.count > c2.count && c2.count < c3.count) {
		//					candidates.push({
		//						distance: distance1 < distance2 ? distance1 : distance2,
		//						...c2,
		//					});
		//				}
		//			}
		//
		//			// Hmm, no candidates for removal
		//			if (!candidates.length) break;
		//
		//			candidates.sort((c1, c2) => {
		//				if (c1.distance != c2.distance) {
		//					return c1.distance - c2.distance;
		//				} else {
		//					return c1.count - c2.count;
		//				}
		//			});
		//
		//			// Make sure we get at least 10 less candidates than colors.
		//			candidates = candidates.slice(0, luminosity.length - 10);
		//
		//			candidates = candidates.map((c) => c.color);
		//
		//			luminosity = luminosity.filter((c) => {
		//				return candidates.indexOf(c.color) === -1;
		//			});
		//		}
		//
		//		// Make sure to limit to 10 colors.
		//		luminosity.sort((c1, c2) => c2.count - c1.count);
		luminosity = luminosity.slice(0, 10);
		console.log(luminosity);

		// Store measurement
		state.colors = luminosity;

		render();
	}

	function render() {
		const { color1, color2, grid, selection, stats, xaxis1, yaxis1 } = elements;
		const { colors, minMax, x1, x2, y1, y2, zoom } = state;

		// Position selection window
		const style = selection.style;
		selection.classList.toggle('hidden', x1 < 0);
		if (x1 >= 0) {
			const left = Math.min(x1, x2);
			const top = Math.min(y1, y2);

			const height = Math.max(y1, y2) - top;
			const width = Math.max(x1, x2) - left;

			style.height = height + 'px';
			style.width = width + 'px';
			style.top = top + 'px';
			style.left = left + 'px';

			xaxis1.style.top = y1 + 'px';
			yaxis1.style.left = x1 + 'px';
		} else {
			xaxis1.style.top = '0px';
			yaxis1.style.left = '0px';
		}

		// Fill in the stats on measurement
		stats.classList.toggle('is-visible', colors.length > 0);

		// We only got no or only one color.
		if (colors.length <= 0) return;

		stats.style.zoom = 1 / zoom;

		let maxRatio = calculateRatio(minMax[0].luminosity, minMax[1].luminosity);
		color1.setAttribute('title', '#' + minMax[0].hex);
		color1.style.background = '#' + minMax[0].hex;
		color2.setAttribute('title', '#' + minMax[1].hex);
		color2.style.background = '#' + minMax[1].hex;
		elements.ratio.innerHTML = maxRatio.toFixed(10);

		// Get rid of the previous table content
		while (grid.firstElementChild) {
			grid.removeChild(grid.firstElementChild);
		}

		if (colors.length === 1) {
			colors.push(colors[0]);
		}

		// Start building the contents for the table
		let html = '<thead><tr><th class="empty"></th>';
		for (let ix = 0; ix < colors.length; ix++) {
			const lx = colors[ix];
			let nameColor = lx.name + '<br/>' + lx.hex;
			let title = lx.name + '\n#' + lx.hex + '\n' + lx.percentage.toFixed(2) + '%';

			let th = '<th class="';
			if (calculateRatio(lx.luminosity, 0.05) < calculateRatio(lx.luminosity, 1.05)) {
				th += 'white';
			} else {
				th += 'black';
			}
			th += '" style="background:#' + lx.hex + '"';
			th += '" title="' + title + '">';

			html += th + '<span>' + nameColor + '</span></th>';
		}
		html += '</tr>';

		if (false) {
			html += '<tr><th>Percentage</th>';
			for (let ix = 0; ix < colors.length; ix++) {
				const lx = colors[ix];
				html +=
					'<td style="font-size:12px">' +
					lx.percentage.toFixed(lx.percentage > 10 ? 1 : 2) +
					'%</td>';
			}
			html += '</tr></thead>';
		}

		for (let iy = 0; iy < colors.length; iy++) {
			const ly = colors[iy];
			let title = ly.name + '\n#' + ly.hex + '\n' + ly.percentage.toFixed(2) + '%';

			html += '<tr><th class="';
			if (calculateRatio(ly.luminosity, 0.05) < calculateRatio(ly.luminosity, 1.05)) {
				html += 'white';
			} else {
				html += 'black';
			}
			html += '" style="background:#' + ly.hex + '" title="';
			html += title + '">';
			html += ly.name.replace('<br/>', ' ') + '<br/>';
			html += ly.hex + ' ';
			html += ly.percentage.toFixed(ly.percentage > 10 ? 1 : 2) + '%';
			html += '</th>';

			for (let ix = 0; ix < colors.length; ix++) {
				const lx = colors[ix];

				const ratio = calculateRatio(lx.luminosity, ly.luminosity);

				html += '<td class="';
				if (iy !== ix) {
					if (ratio < 3.0) {
						html += 'red';
					} else if (ratio < 4.5) {
						html += 'orange';
					} else {
						html += 'green';
					}
					if (ratio === maxRatio) html += ' max" title="Max contrast';
					// Don't round up 4.4999 to 4.5, it is just not the same
					html += '">' + sprintRatio(ratio);
				} else {
					html += 'empty"></td>';
				}
				html += '</td>';
			}

			html += '</tr>';
		}

		grid.innerHTML = html;
	}

	/**
	 * Calucate contrast ratio between two luminosity colors.
	 */
	function calculateRatio(l1, l2) {
		return l1 > l2 ? l1 / l2 : l2 / l1;
	}

	/**
	 * Return ratio as string and be careful not to round up any values.
	 * For example 4.4999 to 4.5, it is just not the same
	 */
	function sprintRatio(ratio) {
		ratio = Math.floor(ratio * 100) / 100;
		return ratio < 10 ? ratio.toFixed(2) : ratio.toFixed(1);
	}

	// https://github.com/gdkraus/wcag2-color-contrast
	function calculateLuminosity(rgb) {
		let r = ((rgb >> 16) & 255) / 255; // red value
		let g = ((rgb >> 8) & 255) / 255; // green value
		let b = ((rgb >> 0) & 255) / 255; // blue value

		if (r <= 0.03928) {
			r = r / 12.92;
		} else {
			r = Math.pow((r + 0.055) / 1.055, 2.4);
		}

		if (g <= 0.03928) {
			g = g / 12.92;
		} else {
			g = Math.pow((g + 0.055) / 1.055, 2.4);
		}

		if (b <= 0.03928) {
			b = b / 12.92;
		} else {
			b = Math.pow((b + 0.055) / 1.055, 2.4);
		}

		let luminosity = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		return luminosity + 0.05;
	}

	// https://github.com/gdkraus/wcag2-color-contrast
	// We forgo the square root for performance reason, since we only compare
	// distances to each other and not interested in specific values.
	function calcEuclideanDistance(c1, c2) {
		return (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2;
	}

	// We forgo the square root for performance reason, since we only compare
	// distances to each other and not interested in specific values.
	function isEuclideanDistance(c1, c2, d) {
		d *= d;
		return (c1.r - c2.r) ** 2 <= d && (c1.g - c2.g) ** 2 <= d && (c1.b - c2.b) ** 2 <= d;
	}

	/**
	 * Converts an RGB color value to HEX.
	 *
	 * @param   Number  rgb     RGB 0xRRGGBB
	 * @return  Array           Hex "RRGGBB"
	 */
	function rgb2hex(rgb) {
		return (0x01000000 + rgb).toString(16).substr(-6).toUpperCase();
	}

	/**
	 * Converts an RGB color value to object.
	 *
	 * @param   Number  rgb     RGB 0xRRGGBB
	 * @return  Object          {r: 0xRR, g: 0xGG, b: 0xBB }
	 */
	function rgb2obj(rgb) {
		return { r: (rgb >> 16) & 0xff, g: (rgb >> 8) & 0xff, b: rgb & 0xff };
	}

	// Listen for messages from the background process.
	chrome.runtime.onMessage.addListener(handleOnMessage);
})();

('OK');
