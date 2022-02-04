const isNested = Boolean(window.parent != window);

const deprecationStrings = [
	{Text: "", Class: "hide"},
	{Text: "Warning! This chip is being deprecated. It will be broken in the near future, and should not be used.", Class: "depwarn"},
	{Text: "Warning! This chip is currently deprecated. It is no longer in the palette, and likely does not work.", Class: "depbad"}
];
const fusenameopts = {
	isCaseSensitive: false,
	minMatchCharLength: 1,
	ignoreLocation: true,
	threshold: 0,
	keys: ["ReadonlyName"]
};
const fusedescopts = {
	isCaseSensitive: false,
	minMatchCharLength: 1,
	ignoreLocation: true,
	threshold: 0,
	keys: ["Description"]
};

function genExplanation(name) {
	return name;
}

function genSearchPath(path, name) {
	const ret = document.createElement("li");
	ret.classList.add("searchpath");
	ret.innerText = path.join("/") + "/" + name;
	return ret;
}

function getChipAddListener(GUID) {
	return function(e) {
		window.parent.postMessage(
			{
				type: 'newChip',
				GUID: GUID
			}
		);
	}
}

var searchresults = [];
var page = 0

window.addEventListener("load", async (e) => {
	const search = document.getElementById("search");
	const form = document.getElementById("form");
	const suggestions = document.getElementById("paletteSearch");

	if (localStorage.length) {
		form.depr.checked = localStorage.getItem("depr");
		form.beta.checked = localStorage.getItem("beta");
		form.ReadonlyName.checked = localStorage.getItem("ReadonlyName");
		form.Description.checked = localStorage.getItem("Description");
		form.refresh.checked = localStorage.getItem("refresh");
		form.fuzziness.value = localStorage.getItem("fuzz");
		form.items.value = localStorage.getItem("items");
		form.filterSug.checked = localStorage.getItem("fsug");
	}

	let v2pr = fetch(/*"https://raw.githubusercontent.com/tyleo-rec/CircuitsV2Resources/master/misc/circuitsv2.json"/*/"circuitsv2.json")
				   .then(res => res.json());
	let termspr = fetch("./terms.json")
									.then(res => res.json());

	[v2json, termsjson] = await Promise.all([v2pr, termspr]);
	//console.log(v2json, termsjson);

	
	//GUID needs to be in the same object now, because we convert to an array
	const searchable = Object.entries(v2json.Nodes)
		.map(pair => {return {GUID: pair[0], ...pair[1]}})
	searchable.sort((a, b) => (a.ReadonlyName.toLowerCase() > b.ReadonlyName.toLowerCase()) ? 1 : -1);

	const fuses = [new Fuse(searchable, fusenameopts),
								 new Fuse(searchable, fusedescopts)];
	
	const filterTree = {nodes: searchable};
	searchable.forEach(chip => {
		chip.NodeFilters.forEach(filter => {
			var currentNode = filterTree;
			filter.FilterPath.forEach(path => {
				if (!currentNode[path.toUpperCase()]) currentNode[path.toUpperCase()] = {nodes: []};
				currentNode = currentNode[path.toUpperCase()]
				if (!currentNode.nodes.includes(chip))currentNode.nodes.push(chip);
				currentNode.actualname = path;
			})
		})
	})

	//console.log(filterTree);

	const redraw = targ => {
		const fuseinuse = fuses.filter(fuse => form[fuse.options.keys[0]].checked);

		start = performance.now();

		localStorage.setItem("depr", form.depr.checked ? "set" : "");
		localStorage.setItem("beta", form.beta.checked ? "set" : "");
		localStorage.setItem("ReadonlyName", form.ReadonlyName.checked ? "set" : "");
		localStorage.setItem("Description", form.Description.checked ? "set" : "");
		localStorage.setItem("refresh", form.refresh.checked ? "set" : "");
		localStorage.setItem("fsug", form.filterSug.checked ? "set" : "");
		localStorage.setItem("fuzz", form.fuzziness.value);
		localStorage.setItem("items", form.items.value);

		suggestions.id = form.filterSug.checked ? "paletteSearch" : ""
		
		var content2 = filterTree;

		const fullPath = targ.value.replace(/\\+|\/+/, "/")
													.split("/");
		const startOfPath = fullPath.slice(0, -1);
		const endOfPath = fullPath.at(-1);
		const startOfSuggestion = startOfPath.join('/');

		startOfPath.forEach(path => {
													try {
														content2 = content2[path.toUpperCase()]
													} catch (e) {}
												});
		
		if (!content2) content2 = {nodes: []};

		suggestions.innerText = '';
		suggestions.append(...Object.keys(content2)
																.filter(i => i.toUpperCase() == i)
																.sort((a, b) => (a > b) ? 1 : -1)
																.map(i => {
																	var e = document.createElement('option');
																	e.value = startOfSuggestion + (startOfSuggestion ? '/' : '') + content2[i].actualname + '/';
																	return e;
																})
											)


		fuseinuse.forEach(fuse => {
			fuse.options.minMatchCharLength = Math.floor(endOfPath.length * JSON.parse(form.fuzziness.value).nummod);
			fuse.options.threshold = JSON.parse(form.fuzziness.value).thresh;
			fuse.setCollection(content2.nodes);
		});
		
		var content = endOfPath ? fuseinuse.map(fuse => fuse.search(endOfPath).map(e => e.item)) : content2.nodes;
		content = Array.from(new Set(content.flat()));
		content.sort((a, b) => (a.ReadonlyName.toLowerCase() > b.ReadonlyName.toLowerCase()) ? 1 : -1);
		//console.log(content2.nodes)
			
		content = content.map(el => {
			if ((form.depr.checked || el.DeprecationStage == 0) && (form.beta.checked || !el.IsBetaChip)) {
				const ret = newEl("details", "returnedchip");
				if (el.IsBetaChip) ret.classList.add("betaChip");

				const iret = newEl("div", "infocontainer");

				const name = document.createElement("summary");
				name.innerText = el.ReadonlyName;

				const deprinfo = deprecationStrings[el.DeprecationStage];
				const depr = newEl("div", deprinfo.Class);
				depr.innerText = deprinfo.Text;

				const desc = newEl("p", "chipdesc")
				desc.innerText = el.Description == "" ? "No Description!" : el.Description;

				const filters = newEl("ul", "filters")
				filters.append(...Object.values(el.NodeFilters).map(val => genSearchPath(val.FilterPath, el.ReadonlyName)));

				iret.append(desc, filters);

				const addBtn = newEl('button', 'addBtn');
				addBtn.innerText = "+";
				addBtn.setAttribute('title', 'Add to graph');
				addBtn.onclick = getChipAddListener(el.GUID);
				if (isNested) name.append(addBtn);
				
				let m = generateChipHTML(el.NodeDescs);

				ret.append(depr, name, iret, m);

				return ret;
			}
		}).filter(e => e != undefined);
		var perfstring = `returned in ${parseInt(performance.now() - start)} ms.`
		display(perfstring, content);
	};

	const redrawHandler = e => redraw(search);

	form.addEventListener("submit", e => {console.log(e); e.preventDefault()});
	search.addEventListener("change", redrawHandler);
	form.addEventListener("input", redrawHandler);

	form.refresh.addEventListener("change", e => {
		if (e.target.checked) {
			form.addEventListener("input", redrawHandler);
		} else {
			form.removeEventListener("input", redrawHandler);
		}
	});
	
	try {
		redraw(search);
	} catch (error) {
		setTimeout(() => redraw(search), 1000); 
	}
});

function display(perf, content) {
	searchresults = content;
	page = 0;
	update();
}

function first() {
	page = 0;
	update();
}
function prev() {
	page = Math.max(page - 1, 0);
	update();
}

function next() {
	const pagesize = parseInt(document.getElementById("cfgitems").value);

	page = (((page + 1) * pagesize) > searchresults.length) ? page : (page + 1);
	update();
}

function last() {
	const pagesize = parseInt(document.getElementById("cfgitems").value);

	page = Math.max(parseInt((searchresults.length - 1) / pagesize), 0);
	update();
}


function update() {
	const ndisplay = document.getElementById("pagen");
	const ofdisplay = document.getElementById("of");
	const output = document.getElementById("resultslist");
	const pagesel = document.getElementById("cfgitems");

	//pagesel.value = ;

	const pagesize = pagesel.value == "" ? 1 : Math.max(parseInt(pagesel.value), 1);

	const start = page * pagesize;
	const end   = Math.min(searchresults.length, start + pagesize);

	ndisplay.innerText = page + 1;
	ofdisplay.innerText = parseInt((searchresults.length - 1) / pagesize) + 1;

	//console.log(start, end);

	output.innerHTML = "";
	output.append(...searchresults.slice(start, end));
}

