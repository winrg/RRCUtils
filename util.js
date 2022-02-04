function newEl(name, Class) {
	ret = document.createElement(name);
	if (Class) ret.classList.add(Class);
	return ret;
}