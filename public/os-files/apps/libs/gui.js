class Element {
	static #id = 0
	static #deleted = []

	constructor(tag) {
		if (deleted.length) this._id = Element.#deleted.shift()
		else this._id = Element._id++

		syscall('dom.create', this._id)
	}

	css(prop, val) {
		syscall('dom.css', this._id, prop, val)
	}

	set text(str) {
		syscall('dom.prop', _id, 'innerText', str)
	}

	append(ele) {
		syscall('dom.append', _id, ele._id)
	}

	size(dim) {
		css('width', dim)
		css('height', dim)
	}
}

class FlexBox extends Element {
	constructor(dir = 'row') {
		super('div')
		css('display', 'flex')
		css('flex-direction', dir)
	}

	set gap(dim) {
		css('gap', dim)
	}
}

class Window {
	static #id = 0
	static #closed = []

	#id;
	
	constructor(tag) {
			if (Window.#closed.length) this.#id = Window.#closed.shift()
			else this.#id = Window.#id++

			syscall('window.open', this.#id)
	}

	set title(title) {
			syscall('window.title', this.#id, title)
	}

	set content(ele) {
			syscall('window.title', this.#id, ele._id)
	}
}

exports.Window = Window
exports.Element = Element