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
		'007398': 'Petrol',
		'009ECE': 'Information',
		'073973': 'Blue3',
		'0C7DBB': 'Link blue',
		'29A61B': 'Confirmation',
		'2E2E2E': 'Grey8',
		'3679E0': 'Blue2',
		'3C1276': 'Purple3',
		'44C6F4': 'Info ondark',
		'496E01': 'Green3',
		'505050': 'Grey7',
		'53565A': 'Dark gray',
		'53B848': 'Confirm ondark',
		'661CCA': 'Purple2',
		'737373': 'Grey6',
		'8ED700': 'Green2',
		'969696': 'Grey5',
		'976500': 'Yellow3',
		A92B1D: 'Red3',
		ACD2FF: 'Blue1',
		B9B9B9: 'Grey4',
		BB84FF: 'Purple1',
		C0F25D: 'Green1',
		C83727: 'Warning',
		CDE4FF: 'Pale blue',
		DCDCDC: 'Grey3',
		DCDCDD: 'Cool grey',
		//E9711C: 'Elsevier orange',
		EBEBEB: 'Grey2',
		F5F5F5: 'Grey1',
		F73E29: 'Red2',
		FDD300: 'Yellow2',
		FEB7B7: 'Red1',
		FF6A5A: 'Warning ondark',
		FF6C00: 'Primary orange',
		FF8200: 'Elsevier orange ondark',
		FFEC84: 'Yellow1',
		FFF0E4: 'Pale orange',
		FFFFFF: 'White',
	};

	const state = {
		colors: [],
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
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
			return;
		// Only left button
		if (event.button !== 0) return;

		event.preventDefault();

		clearMeasurement();
		render();

		state.x1 = event.clientX;
		state.y1 = event.clientY;
		state.drag = true;
		state.colors = [];

		const { xaxis1, yaxis1 } = elements;
		xaxis1.style.top = event.clientY + 'px';
		yaxis1.style.left = event.clientX + 'px';

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

		// Get all unique colors.
		const colors = {};
		for (let i = 0; i < data.length; i += 4) {
			const rgb =
				(data[i] << 16) | (data[i + 1] << 8) | (data[i + 2] << 0);
			if (!colors[rgb]) colors[rgb] = 0;
			colors[rgb]++;
		}

		// Convert from object to array
		const pixels = (width * height) / 100;

		let luminosity = Object.keys(colors).map((key) => {
			const hex = rgb2hex(+key).toUpperCase();
			const lumi = calculateLuminosity(+key);
			return {
				color: +key,
				r: (key >> 16) & 0xff,
				g: (key >> 8) & 0xff,
				b: (key >> 0) & 0xff,
				count: colors[key],
				name: colorNames[hex] || '',
				hex,
				luminosity: lumi,
				percentage: colors[key] / pixels,
			};
		});

		// Order array on usage
		luminosity = luminosity.filter((c1) => c1.count > 2);

		luminosity.sort((c1, c2) => c2.luminosity - c1.luminosity);

		while (luminosity.length > 10) {
			let candidates = [];
			for (let i = luminosity.length - 1; i > 1; i--) {
				const c1 = luminosity[i - 2];
				const c2 = luminosity[i - 1];
				const c3 = luminosity[i - 0];
				const distance1 = calcEuclideanDistance(c1, c2);
				const distance2 = calcEuclideanDistance(c2, c3);

				if (c1.count > c2.count && c2.count < c3.count) {
					candidates.push({
						distance: distance1 < distance2 ? distance1 : distance2,
						...c2,
					});
				}
			}

			// Hmm, no candidates for removal
			if (!candidates.length) break;

			candidates.sort((c1, c2) => {
				if (c1.distance != c2.distance) {
					return c1.distance - c2.distance;
				} else {
					return c1.count - c2.count;
				}
			});

			// Make sure we get at least 10 less candidates than colors.
			candidates = candidates.slice(0, luminosity.length - 10);

			candidates = candidates.map((c) => c.color);

			luminosity = luminosity.filter((c) => {
				return candidates.indexOf(c.color) === -1;
			});
		}
		// console.log(JSON.parse(JSON.stringify(luminosity)));

		// Make sure to limit to 10 colors.
		luminosity.sort((c1, c2) => c2.count - c1.count);
		luminosity = luminosity.slice(0, 10);

		// Store measurement
		state.colors = luminosity;

		render();
	}

	function render() {
		const { color1, color2, grid, selection, stats } = elements;
		const { colors, x1, x2, y1, y2, zoom } = state;

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
		}

		// Fill in the stats on measurement
		stats.classList.toggle('is-visible', colors.length > 1);

		// We only got no or only one color.
		if (colors.length <= 1) return;

		stats.style.zoom = 1 / zoom;

		// Find maximum ratio and populate it on screen.
		let maxRatio = 1;
		for (let iy = 0; iy < colors.length; iy++) {
			for (let ix = iy; ix < colors.length; ix++) {
				let ratio = calculateRatio(
					colors[ix].luminosity,
					colors[iy].luminosity
				);
				if (maxRatio < ratio) {
					maxRatio = ratio;
					color1.setAttribute('title', '#' + colors[ix].hex);
					color1.style.background = '#' + colors[ix].hex;
					color2.setAttribute('title', '#' + colors[iy].hex);
					color2.style.background = '#' + colors[iy].hex;
					elements.ratio.innerHTML = sprintRatio(ratio);
				}
			}
		}

		// Get rid of the previous table content
		while (grid.firstElementChild) {
			grid.removeChild(grid.firstElementChild);
		}

		// Start building the contents for the table
		let html =
			'<thead><tr><th class="empty"></th><th class="white"><span>Percen-<br/>tage</span></th>';
		for (let ix = 1; ix < colors.length; ix++) {
			const lx = colors[ix];
			let nameColor = lx.name + '<br/>' + lx.hex;
			let title =
				lx.name +
				'\n#' +
				lx.hex +
				'\n' +
				lx.percentage.toFixed(2) +
				'%';

			let th = '<th class="';
			if (
				calculateRatio(lx.luminosity, 0.05) <
				calculateRatio(lx.luminosity, 1.05)
			) {
				th += 'white';
			} else {
				th += 'black';
			}
			th += '" style="background:#' + lx.hex + '"';
			th += '" title="' + title + '">';

			html += th + '<span>' + nameColor + '</span></th>';
		}
		html += '</tr></thead>';

		for (let iy = 0; iy < colors.length - 1; iy++) {
			const ly = colors[iy];
			let title =
				ly.name +
				'\n#' +
				ly.hex +
				'\n' +
				ly.percentage.toFixed(2) +
				'%';

			html += '<tr><th class="';
			if (
				calculateRatio(ly.luminosity, 0.05) <
				calculateRatio(ly.luminosity, 1.05)
			) {
				html += 'white';
			} else {
				html += 'black';
			}
			html += '" style="background:#' + ly.hex + '" title="';
			html += title + '">';
			html += ly.name + '<br/>';
			html += ly.hex;
			html += '</th>';
			html +=
				'<td style="font-size:12px">' +
				ly.percentage.toFixed(ly.percentage > 10 ? 1 : 2) +
				'%</td>';

			for (let ix = 1; ix < colors.length; ix++) {
				const lx = colors[ix];

				const ratio = calculateRatio(lx.luminosity, ly.luminosity);

				html += '<td class="';
				if (iy < ix) {
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

	/**
	 * Converts an RGB color value to HEX.
	 *
	 * @param   Number  rgb     RGB 0xRRGGBB
	 * @return  Array           Hex "RRGGBB"
	 */
	function rgb2hex(rgb) {
		let hex = rgb.toString(16);
		if (hex.length < 6) hex = ('00000' + hex).substr(-6);
		return hex;
	}

	// Listen for messages from the background process.
	chrome.runtime.onMessage.addListener(handleOnMessage);
})();

('OK');
