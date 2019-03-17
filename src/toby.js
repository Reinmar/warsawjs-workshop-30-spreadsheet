/* global document, requestAnimationFrame */

const ROW_HEIGHT = 30;
const COLUMN_WIDTH = 120;
const BORDER_WIDTH = 1;
const PRELOAD_ROWS = 5;

const objectsPool = [];

export default class Toby {
	/**
	 * @param {DataSource} dataSource
	 */
	constructor( dataSource ) {
		/**
		 * @type {DataSource}
		 */
		this.dataSource = dataSource;

		/**
		 * The first row which is currently in the DOM.
		 *
		 * @type {Number}
		 */
		this.firstRenderedRow = Number.MAX_SAFE_INTEGER;

		/**
		 * The last row which is currently in the DOM.
		 *
		 * @type {Number}
		 */
		this.lastRenderedRow = -1;

		/**
		 * The sentinel element – guards the scroll size by stretching the container.
		 *
		 * @type {Element}
		 */
		this._sentinel = this._createSentinelElement();

		/**
		 * The current sentinel's position from the top of the container.
		 */
		this._sentinelPosition = 0;

		/**
		 * The array of row elements which are currently in the DOM.
		 *
		 * @type {Array.<Element>}
		 */
		this._renderedRowElements = [];

		this.cellPrototype = document.createElement( 'div' );
		this.cellPrototype.style.height = ROW_HEIGHT + 'px';
		this.cellPrototype.style.width = COLUMN_WIDTH + 'px';
		this.cellPrototype.classList.add( 'cell' );
	}

	/**
	 * Attaches this toby instance to the given elements.
	 */
	attachTo( { container, statusBar } ) {
		this.container = container;
		this.cellStatusElement = statusBar.querySelector( '.status-bar__current-cell' );

		this.render();

		container.appendChild( this._sentinel );

		const update = () => {
			this.render();

			requestAnimationFrame( update );
		};

		requestAnimationFrame( update );
	}

	/**
	 * Detaches this toby instance.
	 */
	destroy() {
		this.container.innerHTML = '';
	}

	/**
	 * Updates the list of rows which should be rendered based on the current viewport position.
	 */
	render() {
		const visibleRows = getVisibleRowRange( getViewport( this.container ) );

		this._update( visibleRows );
	}

	/**
	 * Renders missing rows and removes excessive rows.
	 *
	 * @param {Array.<Number>} rowsToRender Rows which should currently be rendered.
	 */
	_update( rowsToRender ) {
		const firstRenderedRow = this.firstRenderedRow;
		const lastRenderedRow = this.lastRenderedRow;

		// The visible range of of rows extended with the given number of rows "beyond the fold".
		// This is – there should always be a couple of rows outside of the viewport so the user
		// doesn't see that they are being rendered as he/she scrolls.
		const firstToRender = Math.max( 0, rowsToRender.first - PRELOAD_ROWS );
		const lastToRender = Math.max( 0, rowsToRender.last + PRELOAD_ROWS );

		// Update the rows from the first one which should be added or removed
		// to the last one which should be added or removed.
		const start = Math.min( firstRenderedRow, firstToRender );
		const end = Math.max( lastRenderedRow, lastToRender );

		for ( let row = start; row <= end; row++ ) {
			if ( row >= firstToRender && row <= lastToRender ) {
				// If the current row should be rendered (in the DOM) but isn't present in the
				// table of rendered rows (wasn't rendered so far), render it.
				if ( !this._renderedRowElements[ row ] ) {
					const rowElement = this._renderRow( row );

					this.container.appendChild( rowElement );

					this._renderedRowElements[ row ] = rowElement;
				}
			} else {
				// If the current row should not be rendered but is currently rendered, remove it from the DOM.
				if ( this._renderedRowElements[ row ] ) {
					objectsPool.push(this._renderedRowElements[ row ]);
					this._renderedRowElements[ row ].remove();
					this._renderedRowElements[ row ] = null;
				}
			}
		}

		this.firstRenderedRow = firstToRender;
		this.lastRenderedRow = lastToRender;

		this._updateSentinel( lastToRender );
	}

	/**
	 * Creates a row element and fills the cells inside it with the data of this row.
	 *
	 * @param {Number} row The number of the row to render.
	 * @returns {Element} The rendered row element.
	 */
	_renderRow( row ) {
		const rowElement = this._createRowElement( row );

		for ( let col = 0; col < this.dataSource.numberOfColumns; col++ ) {
			const value = this.dataSource.getItem( row, col );

			rowElement.childNodes[ col ].textContent = value;
		}

		return rowElement;
	}

	/**
	 * Creates a row element and all its cells.
	 *
	 * @param {Number} row The number of the row to create.
	 * @returns {Element} The rendered row element (with empty cells).
	 */
	_createRowElement( row ) {
		let rowElement = objectsPool.pop();

		if ( !rowElement ) {
			rowElement = document.createElement( 'div' );
			rowElement.classList.add( 'row' );

			for ( let col = 0; col < this.dataSource.numberOfColumns; col++ ) {
				rowElement.appendChild( this._createCellElement( col ) );
			}
		}

		rowElement.style.transform = `translateY(${ row * ( ROW_HEIGHT + BORDER_WIDTH ) }px)`;

		return rowElement;
	}

	/**
	 * Creates a cell element.
	 *
	 * @param {Number} row The number of the row to render
	 * @returns {Element} The rendered row element (with empty cells).
	 */
	_createCellElement( col ) {
		const cellElement = this.cellPrototype.cloneNode();

		// cellElement.dataset.col = col;
		// cellElement.style.transform = `translateX(${ col * ( COLUMN_WIDTH + BORDER_WIDTH ) }px)`;

		cellElement.addEventListener( 'mouseenter', () => {
			// this._setCellStatusTo( cellElement.parentNode.dataset.row, col );
		} );
		cellElement.addEventListener( 'mouseleave', () => {
			// this._setCellStatusTo( null );
		} );

		return cellElement;
	}

	_createSentinelElement() {
		const sentinelElement = document.createElement( 'div' );

		Object.assign( sentinelElement.style, {
			position: 'absolute',
			height: '1px',
			width: '1px'
		} );

		return sentinelElement;
	}

	_setCellStatusTo( row, col ) {
		if ( row === null ) {
			this.cellStatusElement.innerHTML = '';

			return;
		}

		this.cellStatusElement.innerHTML = `row: ${ row }, col: ${ col }, data: ${ this.dataSource.getItem( row, col ) }`;
	}

	/**
	 * Updates the sentinel's position to be 5 rows below the last rendered row.
	 * Thanks to that there's always space for the scroll to move.
	 */
	_updateSentinel( lastRow ) {
		const stretchToRow = lastRow + 5;

		if ( stretchToRow > this._sentinelPosition ) {
			// Theoretically, setting transform should work fine, but
			// it didn't work in some (random) cases. Seemed to be a Blink's bug.
			// this._sentinel.style.transform = `translateY(${ stretchToRow * ( ROW_HEIGHT + BORDER_WIDTH ) }px)`;

			this._sentinel.style.top = `${ stretchToRow * ( ROW_HEIGHT + BORDER_WIDTH ) }px`;

			this._sentinelPosition = stretchToRow;
		}
	}
}


/**
 * Gets the viewport position (the visible part of the given container element's content).
 *
 *		// The below means that the visible part of the element
 *		// starts at position 100px from its top to 500px from its top.
 *		getViewport( container ); // -> { top: 100, bottom: 500 }
 *
 * @param {Element} container Scrollable container.
 * @returns {Object} The viewport position (its top and bottom positions in pixels).
 */
function getViewport( container ) {
	return {
		top: container.scrollTop,
		bottom: container.scrollTop + container.offsetHeight
	};
}

/**
 * Calculates the first and last rows visible in the given viewport.
 *
 * @param {Object} viewport
 * @returns {OBject} The first and last visible rows.
 */
function getVisibleRowRange( viewport ) {
	const fullRowHeight = ROW_HEIGHT + BORDER_WIDTH;

	const first = Math.floor( viewport.top / fullRowHeight );
	const last = Math.floor( viewport.bottom / fullRowHeight );

	return { first, last };
}
