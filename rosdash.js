var ROSDASH = new Object();


///////////////////////////////////// constant parameters


// the status of development, i.e. devel, stable
ROSDASH.develStatus = "devel";

// the parameters from url, executes immediately
ROSDASH.queryString = function () {
  // This function is anonymous, is executed immediately and 
  // the return value is assigned to QueryString!
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    	// If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = pair[1];
    	// If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]], pair[1] ];
      query_string[pair[0]] = arr;
    	// If third or later entry with this name
    } else {
      query_string[pair[0]].push(pair[1]);
    }
  } 
    return query_string;
} ();


///////////////////////////////////// events


// event emitter
ROSDASH.ee = ("EventEmitter" in window) ? new EventEmitter() : undefined;
// event when the page is loaded
$(document).ready(function() {
	// event when the document has been fully loaded
	ROSDASH.ee.emitEvent('pageReady');
});


///////////////////////////////////// dashboard


// load the entire dashboard
ROSDASH.startDash = function ()
{
	ROSDASH.initJson();
	ROSDASH.initToolbar("toolbar");
	ROSDASH.initSidebar("sidebar");
	ROSDASH.loadDash();
}
// load an empty dashboard
ROSDASH.loadDash = function ()
{
	$("#editor").empty();
	// create empty dashboard editor
	$("#editor").sDashboard({
		dashboardData : [],
		disableSelection : ROSDASH.dashConf.disable_selection
	});
	ROSDASH.dashBindEvent("editor");

	$("#cy").empty();
	// create an empty cytoscape diagram
	$('#cy').cytoscape({
		showOverlay: false,
		style: ROSDASH.defaultStyle,
		elements: {nodes: new Array(), edges: new Array()},
		ready: function ()
		{
			window.cy = this;
		}
	});
}
// show view or not
ROSDASH.showView = function (from, to)
{
	// if the same view
	if (to == from)
	{
		return;
	}
	// only editor and diagram have sidebar
	if ("editor" == to || "diagram" == to)
	{
		$("#canvas").css("left", "160px");
		$("#sidebar").css("visibility", "inherit");
	} else
	{
		// remove sidebar
		$("#canvas").css("left", "0px");
		$("#sidebar").css("visibility", "hidden");
	}
	var from_canvas;
	// remove the original view
	switch (from)
	{
	case "panel":
		from_canvas = "dash";
		break;
	case "editor":
		from_canvas = "editor";
		break;
	case "diagram":
		from_canvas = "cy";
		break;
	case "json":
		from_canvas = "json";
		break;
	case "docs":
		from_canvas = "docs";
		break;
	default:
		break;
	}
	if (undefined !== from_canvas)
	{
		// hide it
		$("#" + from_canvas).css("visibility", "hidden");
		// fade out
		$("#" + from_canvas).fadeOut("slow");
	}
	var to_canvas;
	// show the new view
	switch (to)
	{
	case "panel":
		to_canvas = "dash";
		ROSDASH.resetPanelToolbar();
		break;
	case "editor":
		to_canvas = "editor";
		ROSDASH.resetEditorToolbar();
		break;
	case "diagram":
		to_canvas = "cy";
		ROSDASH.resetDiagramToolbar();
		break;
	case "json":
		to_canvas = "json";
		ROSDASH.resetJsonToolbar();
		ROSDASH.loadJsonEditor(ROSDASH.getDashJson());
		break;
	case "docs":
		to_canvas = "docs";
		ROSDASH.resetJsonToolbar();
		break;
	default:
		to_canvas = undefined;
		console.error("show wrong view", from, to);
		break;
	}
	if (undefined !== to_canvas)
	{
		// show it
		$("#" + to_canvas).css("visibility", "inherit");
		// fade in
		$("#" + to_canvas).fadeIn("slow");
	}
	// switch to new view type
	ROSDASH.dashConf.view = to;
	// init sidebar form
	ROSDASH.initForm();
}

// if dashboard has been changed
ROSDASH.dashChanged = false;
// create a json representing a dashboard
ROSDASH.getDashJson = function ()
{
	var json = ROSDASH.dashConf;
	json.version = ROSDASH.version;
	json.date = new Date().toString();
	// panel widgets
	json.widgets = ROSDASH.widgets;
	// diagram blocks
	json.block = new Object();
	// diagram edges
	json.edge = new Array();
	if ("cy" in window)
	{
		// don't save popups into file
		ROSDASH.removeAllPopup();
		// add all blocks into json
		for (var i in ROSDASH.blocks)
		{
			json.block[i] = ROSDASH.blocks[i];
		}
		// add all edges into json
		window.cy.edges().each(function (i, ele)
		{
			var e = {
				source: ele.source().id(),
				target: ele.target().id()
			};
			json.edge.push(e);
		});
	}
	return json;
}

// dashboard configuration
ROSDASH.dashConf = {
	// basic
	name: "index",
	discrip: "",
	view: "editor",

	// ros
	host: "",
	port: "",

	// dependencies
	require: [],
	//@deprecated
	js: [],
	css: [],
	json: [],

	// panel
	disable_selection: true,
	run_msec: 200,
	widget_width: 400,
	widget_height: 230,
	header_height: 16,
	content_height: 180
};
// if started loading json files specified by dash file
ROSDASH.loadDashJson = false;
// set config, and load required json
ROSDASH.setDashConf = function (conf)
{
	// set all config
	for (var i in conf)
	{
		if (i in ROSDASH.dashConf)
		{
			if ("version" == i && ROSDASH.dashConf.version != conf.version)
			{
				console.error("configure version conflicts", conf.version, ROSDASH.dashConf.version);
				continue;
			}
			if ("panel_name" == i && ROSDASH.dashConf.name != conf.name)
			{
				console.error("panel_name conflicts", conf.name, ROSDASH.dashConf.name);
				continue;
			}
			ROSDASH.dashConf[i] = conf[i];
		}
	}
	ROSDASH.checkDashConfValid(ROSDASH.dashConf);
	// load json specified by dash config
	for (var i in ROSDASH.dashConf.json)
	{
		if (undefined === ROSDASH.dashConf.json[i] || "" == ROSDASH.dashConf.json[i] || " " == ROSDASH.dashConf.json[i])
		{
			continue;
		}
		ROSDASH.loadJson(ROSDASH.dashConf.json[i], function (json)
		{
			ROSDASH.loadWidgetDef(json.widgets);
		});
	}
	ROSDASH.loadDashJson = true;
}
// check if dashboard config is valid or not
ROSDASH.checkDashConfValid = function (conf)
{
	// run speed too fast
	if (conf.run_msec < 1)
	{
		console.warning("run_msec is too low: ", conf.run_msec);
		conf.run_msec = 100;
	}
	// set default port
	if (undefined === conf.port || "" == conf.port || " " == conf.port)
	{
		conf.port = "9090";
	}
}


///////////////////////////////////// editor


// load widgets from json
ROSDASH.loadEditor = function (json)
{
	//@bug remove previous widgets
	for (var i in ROSDASH.widgets)
	{
		ROSDASH.removeWidget(i);
	}
	if (null === json)
	{
		return;
	}
	var count = 0;
	for (var i in json)
	{
		++ count;
	}
	while (count)
	{
		// find the max widget position and add it
		var max = -1;
		var max_num;
		for (var i in json)
		{
			var pos = parseInt(json[i].pos);
			if (pos > max)
			{
				max = pos;
				max_num = i;
			}
		}
		ROSDASH.addWidget(json[max_num]);
		delete json[max_num];
		-- count;
	}
}
// bind callback functions
ROSDASH.dashBindEvent = function (canvas)
{
	$("#" + canvas).bind("sdashboardorderchanged", function(e, data)
	{
		ROSDASH.moveWidget(data.sortedDefinitions);
	});
	$("#" + canvas).bind("sdashboardheaderclicked", ROSDASH.selectWidgetCallback);
	$("#" + canvas).bind("sdashboardwidgetmaximized", ROSDASH.widgetMaxCallback);
	$("#" + canvas).bind("sdashboardwidgetminimized", ROSDASH.widgetMaxCallback);
	$("#" + canvas).bind("sdashboardwidgetadded", ROSDASH.widgetAddCallback);
	$("#" + canvas).bind("sdashboardwidgetremoved", function(e, data)
	{
		ROSDASH.removeWidget(data.widgetDefinition.widgetId);
	});
	$("#" + canvas).bind("sdashboardwidgetset", ROSDASH.widgetSetCallback);
	$("#" + canvas).bind("sdashboardheaderset", ROSDASH.headerSetCallback);
}
ROSDASH.widgetMaxCallback = function (e, data)
{}
ROSDASH.widgetAddCallback = function (e, data)
{}
ROSDASH.widgetSetCallback = function (e, data)
{}
ROSDASH.headerSetCallback = function (e, data)
{}


///////////////////////////////////// panel


// load widgets from json
ROSDASH.loadPanel = function (widgets)
{
	if (undefined === widgets)
	{
		return;
	}
	// create an empty panel
	$("#dash").empty();
	$("#dash").sDashboard({
		dashboardData : [],
		disableSelection : ROSDASH.dashConf.disable_selection
	});
	ROSDASH.dashBindEvent("dash");

	// copy them
	var json = $.extend(true, [], widgets);
	var count = 0;
	for (var i in json)
	{
		++ count;
	}
	while (count)
	{
		// find the max widget position and add it
		var max = -1;
		var max_num;
		for (var i in json)
		{
			var pos = parseInt(json[i].pos);
			if (pos > max)
			{
				max = pos;
				max_num = i;
			}
		}
		// add widget content
		try
		{
			json[max_num] = ROSDASH.setWidgetContent(json[max_num]);
			$("#dash").sDashboard("addWidget", json[max_num]);
		} catch (err)
		{
			console.error("add widget content error", err.message, err.stack);
		}
		delete json[max_num];
		-- count;
	}
	ROSDASH.ee.emitEvent("panelReady");
}
// start to run widgets
ROSDASH.runPanel = function ()
{
	ROSDASH.ee.emitEvent("initBegin");
	ROSDASH.initWidgets();
	ROSDASH.ee.emitEvent("runBegin");
	ROSDASH.runWidgets();
}


///////////////////////////////////// diagram


// depend on cytoscape.js
ROSDASH.defaultStyle = ("cytoscape" in window) ? cytoscape.stylesheet()
	.selector('node').css({
		'shape': 'data(faveShape)',
		'background-color': 'data(faveColor)',
		'border-width': 1,
		'border-color': 'black',
		'width': 'mapData(weight, 10, 30, 20, 60)',
		'height': 'mapData(height, 0, 100, 10, 45)',
		'content': 'data(name)',
		'font-size': 25,
		'text-valign': 'center',
		'text-outline-width': 2,
		'text-outline-color': 'data(faveColor)',
		'color': 'black'
	})
	.selector(':selected').css({
		'border-width': 3,
		'border-color': 'black',
		'color': 'red'
	})
	.selector('edge').css({
		'width': 'mapData(strength, 70, 100, 2, 6)',
		'line-color': 'data(faveColor)',
		'target-arrow-shape': 'triangle',
		'source-arrow-color': 'data(faveColor)',
		'target-arrow-color': 'data(faveColor)'
	})
	.selector('.body').css({
		'shape': 'roundrectangle',
		'width': '130',
		'height': '70'
	})
	.selector('.input').css({
		'shape': 'rectangle',
		'width': '10',
		'height': '10',
		'text-outline-color': 'grey',
		'background-color': 'grey',
		'border-width': 0,
	})
	.selector('.output').css({
		'shape': 'rectangle',
		'width': '10',
		'height': '10',
		'text-outline-color': 'grey',
		'background-color': 'grey',
		'border-width': 0,
	})
: undefined;
// load diagram from json
ROSDASH.loadDiagram = function (json)
{
	// if canvas is not loaded
	if ($("#cy").length <= 0 || undefined === window.cy || typeof window.cy.fit != "function")
	{
		setTimeout(function () {
			ROSDASH.loadDiagram(json);
		}, 300);
		return;
	}
	// remove previous data
	try {
		window.cy.remove(window.cy.elements("node"));
		window.cy.remove(window.cy.elements("edge"));
	} catch (error)
	{
		console.error("cy not ready", window.cy, error);
		setTimeout(function () {
			ROSDASH.loadDiagram(json);
		}, 300);
		return;
	}
	// load blocks
	for (var i in json.block)
	{
		ROSDASH.addBlock(json.block[i]);
	}
	// load edges
	for (var i in json.edge)
	{
		// identify the source and target
		var source = json.edge[i].source;
		var index = source.lastIndexOf("-");
		var type1 = source.substring(index + 1, index + 2);
		var target = json.edge[i].target;
		index = target.lastIndexOf("-");
		var type2 = target.substring(index + 1, index + 2);
		if ("o" == type1 && "i" == type2)
		{
			ROSDASH.connectBlocks(source, target);
		} else if ("i" == type1 && "o" == type2)
		{
			ROSDASH.connectBlocks(target, source);
		}
	}
	// fit page into best view
	window.cy.fit();
	// set callback functions
	ROSDASH.blockMoveCallback();
	ROSDASH.connectBlocksCallback();
	window.cy.on('select', ROSDASH.selectBlockCallback);
	window.cy.on('unselect', ROSDASH.removeAllPopup);
	// fit to selected block from url
	if (undefined !== ROSDASH.selectedBlock)
	{
		ROSDASH.findBlock(ROSDASH.selectedBlock);
	}
	ROSDASH.ee.emitEvent("diagramReady");
}


///////////////////////////////////// jsonEditor


// the json in jsonEditor
ROSDASH.jsonEditorJson = {
	"string": "test",
	"number": 5,
	"array": [1, 2, 3],
	"object": {
		"property": "test1",
		"subobj": {
			"arr": ["test2", "test3"],
			"numero": 1
		}
	}
};
// load it
ROSDASH.loadJsonEditor = function (src)
{
	ROSDASH.jsonEditorJson = src;
	// callback for json text
    $('#jsontext').change(function () {
        var val = $('#jsontext').val();
        if (val)
        {
            try {
				ROSDASH.jsonEditorJson = JSON.parse(val);
			}
            catch (e) {
				console.error('Error in parsing json', e);
				return;
			}
			// update jsoneditor
			$('#jsoneditor').jsonEditor(ROSDASH.jsonEditorJson, { change: function (data) {
				ROSDASH.jsonEditorJson  = data;
				// update jsontext
				$('#jsontext').val(JSON.stringify(json));
				// reload everything
				ROSDASH.loadEditor(data.widgets);
				ROSDASH.loadDiagram(data);
			}, propertyclick: null });
			// reload everything
			ROSDASH.loadEditor(ROSDASH.jsonEditorJson.widgets);
			ROSDASH.loadDiagram(ROSDASH.jsonEditorJson);
        } else
        {
			console.error("invalid json", val);
			return;
        }
    });
    // callback for expander button
    $('#expander').click(function () {
        var editor = $('#jsoneditor');
        editor.toggleClass('expanded');
        $(this).text(editor.hasClass('expanded') ? 'Collapse' : 'Expand all');
    });
	// set json to jsoneditor and text
	$('#jsontext').val(JSON.stringify(ROSDASH.jsonEditorJson));
    $('#jsoneditor').jsonEditor(ROSDASH.jsonEditorJson, { change: function (data) {
		ROSDASH.jsonEditorJson  = data;
		// update jsontext
		$('#jsontext').val(JSON.stringify(json));
		// reload everything
		ROSDASH.loadEditor(data.widgets);
		ROSDASH.loadDiagram(data);
	}, propertyclick: null });
}


///////////////////////////////////// block definitions@here


// json file names for blocks
ROSDASH.blockFiles = ["blocks.json"];
// block definitions
ROSDASH.blockDef = new Object();
// block lists for sidebar
ROSDASH.blockList = new Object();
// widget lists for sidebar
ROSDASH.widgetList = new Object();

// load widget json from files
ROSDASH.loadBlockFiles = function (files)
{
	// load from widget definition json
	for (var i in files)
	{
		ROSDASH.loadJson(files[i], function (json)
		{
			ROSDASH.loadWidgetDef(json.widgets);
		});
	}
}
// load widgets from json
ROSDASH.loadWidgetDef = function (data)
{
	// for each widget json
	for (var k in data)
	{
		// wrong format
		if (! ("type" in data[k]))
		{
			continue;
		}
		// save to ROSDASH.blockDef
		ROSDASH.blockDef[data[k].type] = data[k];
		// save to list for sidebar
		ROSDASH.loadBlockList(data[k]);
	}
}
// set to sidebar lists
ROSDASH.loadBlockList = function (json)
{
	// alias for block list for sidebar
	var list = ROSDASH.blockList;
	// alias for widget list for panel sidebar
	var list2 = ROSDASH.widgetList;
	// add category name to list
	for (var m in json.category)
	{
		// alias
		var c = json.category[m];
		// goto this category directory
		if (c in list)
		{
			list = list[c];
		} else
		{
			// add to block category directory
			list[c] = new Object();
			list = list[c];
		}
		// add to widget category directory
		if (json.has_panel)
		{
			if (c in list2)
			{
				list2 = list2[c];
			} else
			{
				list2[c] = new Object();
				list2 = list2[c];
			}
		}
	}
	// add definition to block list
	if (! ("_" in list))
	{
		list["_"] = new Array();
	}
	list["_"].push(json.type);
	// add definition to widget list
	if (json.has_panel)
	{
		if (! ("_" in list2))
		{
			list2["_"] = new Array();
		}
		list2["_"].push(json.type);
	}
}

// if widget name valid in widget definition list
ROSDASH.checkBlockTypeValid = function (name)
{
	return (name in ROSDASH.blockDef) && ("class_name" in ROSDASH.blockDef[name]);
}


///////////////////////////////////// msg type definitions


// file path list for msg jsons
ROSDASH.msgFiles = ["msgs.json"];
// msg list for sidebar
ROSDASH.msgList = new Object();
// msg definitions
ROSDASH.msgs = new Object();

// load message type definitions from json files
ROSDASH.loadMsgJson = function ()
{
	for (var i in ROSDASH.msgFiles)
	{
		ROSDASH.loadJson(ROSDASH.msgFiles[i]);
	}
}
// parse message for sidebar list
ROSDASH.loadMsgDef = function ()
{
	if (undefined === ROSDASH.msgList)
	{
		ROSDASH.msgList = new Object();
	}
	if (undefined === ROSDASH.msgList["_"])
	{
		ROSDASH.msgList["_"] = new Array();
	}
	// add to msg list
	var list = ROSDASH.msgList["_"];
	for (var i in ROSDASH.msgFiles)
	{
		var data = ROSDASH.jsonLoadList[ROSDASH.msgFiles[i]].data.msgs;
		for (var j in data)
		{
			if (undefined != data[j].name)
			{
				// add to definition list
				ROSDASH.msgs[data[j].name] = data[j];
				// add to msg list for sidebar
				list.push(data[j].name);
			}
		}
	}
	ROSDASH.traverseMsgType();
}

//@todo msg type relations
ROSDASH.msgTypes = new Object();
ROSDASH.traverseMsgType = function ()
{
	for (var i in ROSDASH.msgs)
	{
		if (! (i in ROSDASH.msgTypes))
		{
			ROSDASH.msgTypes[i] = "msgs";
		}
		if (typeof ROSDASH.msgs[i].definition != "array")
		{
			continue;
		}
		for (var j in ROSDASH.msgs[i].definition)
		{
			if (! ("type" in ROSDASH.msgs[i].definition[j]))
			{
				continue;
			}
			ROSDASH.msgTypes[ROSDASH.msgs[i].definition[j].type] = "def";
		}
	}
}

// the default value for a msg
ROSDASH.getMsgDefaultValue = function (name)
{
	// not exist
	if (! (name in ROSDASH.msgs) || ! ("definition" in ROSDASH.msgs[name]))
	{
		console.error("getMsgDefaultValue error", name);
		return null;
	}
	var value;
	// if it is a simple value without sub-msgs
	if (1 == ROSDASH.msgs[name].definition.length)
	{
		switch (ROSDASH.msgs[name].definition[0].type)
		{
		case "int32":
		case "int64":
			value = 0;
			break;
		case "float32":
		case "float64":
			value = 0.0;
			break;
		case "string":
		default:
			value = "";
			break;
		}
	} else
	{
		// an json value
		value = new Object();
		for (var i in ROSDASH.msgs[name].definition)
		{
			value[ROSDASH.msgs[name].definition[i].name] = "";
		}
	}
	return value;
}
//@deprecated get message type definitions from ROSDASH.msg_json
ROSDASH.getMsgDef = function (name)
{
	for (var i in ROSDASH.msgFiles)
	{
		var json = ROSDASH.jsonLoadList[ROSDASH.msgFiles[i]].data;
		for (var j in json)
		{
			var json2 = json[j];
			if (undefined === json2.name)
			{
				for (var k in json2)
				{
					if (json2[k].name == name)
					{
						return json2[k];
					}
				}
			} else
			{
				if (json2.name == name)
				{
					return json2;
				}
			}
		}
	}
	return undefined;
}
// check if it is an existing msg type
ROSDASH.checkMsgTypeValid = function (name)
{
	return (undefined !== ROSDASH.getMsgDef(name));
}


///////////////////////////////////// load json


// the data list from json files
ROSDASH.jsonLoadList = new Object();
ROSDASH.frontpageJson = 'data/output.json';
// init loading msg type and widget definitions from json files
ROSDASH.initJson = function ()
{
	ROSDASH.loadMsgJson();
	ROSDASH.loadBlockFiles(ROSDASH.blockFiles);
	// load the frontpage from json file
	ROSDASH.loadJson(ROSDASH.frontpageJson, function (json)
	{
		ROSDASH.connectROS(ROSDASH.dashConf.host, ROSDASH.dashConf.port);
		// load panel
		ROSDASH.loadEditor(ROSDASH.jsonLoadList[ROSDASH.frontpageJson].data.widgets);
		// load diagram
		ROSDASH.loadDiagram(ROSDASH.jsonLoadList[ROSDASH.frontpageJson].data);
	});
	ROSDASH.waitJson();
}

// status if all json loading are ready
ROSDASH.jsonReady = false;
// wait when loading jsons
ROSDASH.waitJson = function ()
{
	//@deprecated if dash conf is loaded, load specified jsons. must be executed before examine jsonLoadList
	var conf_path = "data/index/conf.json";
	if (! ROSDASH.loadDashJson && (conf_path in ROSDASH.jsonLoadList) && 2 == ROSDASH.jsonLoadList[conf_path].status)
	{
		ROSDASH.setDashConf(ROSDASH.jsonLoadList[conf_path].data);
	}
	// if loading finishes or not
	var flag = true;
	for (var i in ROSDASH.jsonLoadList)
	{
		// if loading fails
		if (ROSDASH.jsonLoadList[i].status < 0)
		{
			// don't reload, just ignore it
		}
		// if loading is unsuccessful or not finishes
		else if (ROSDASH.jsonLoadList[i].status < 2 && ROSDASH.jsonLoadList[i].status >= 0)
		{
			flag = false;
			// if returned but not succeed, read again
			if (1 == ROSDASH.jsonLoadList[i].status)
			{
				console.warn("load file again", i);
				ROSDASH.loadJson(i);
			}
			break;
		}
	}
	// if not ready
	if (! flag)
	{
		// wait again
		setTimeout(ROSDASH.waitJson, 300);
	} else
	{
		// emit a event for json ready
		ROSDASH.ee.emitEvent("jsonReady");
		ROSDASH.jsonReady = true;
		// parse msgs after loading json
		ROSDASH.loadMsgDef();
	}
}


///////////////////////////////////// widget requirements


// a list of requirements, i.e. js, css, json, etc.
ROSDASH.loadList = new Object();
// check all statically loaded scripts
ROSDASH.checkScripts = function ()
{
	$("script").each(function (key, value) {
		var src = $(this).attr("src");
		ROSDASH.loadList[src] = new Object();
		ROSDASH.loadList[src].data = value;
		ROSDASH.loadList[src].type = undefined;
		ROSDASH.loadList[src].status = 2;
	});
}
ROSDASH.ee.addListener("pageReady", ROSDASH.checkScripts);

// load required files, i.e. js, css, etc.
ROSDASH.loadRequired = function (i)
{
	// load required js
	if (undefined !== ROSDASH.blockDef[ROSDASH.connection[i].block.type] && undefined !== ROSDASH.blockDef[ROSDASH.connection[i].block.type].js)
	{
		for (var j in ROSDASH.blockDef[ROSDASH.connection[i].block.type].js)
		{
			try {
				ROSDASH.loadJs(ROSDASH.blockDef[ROSDASH.connection[i].block.type].js[j]);
			} catch (err)
			{
				ROSDASH.connection[i].error = true;
				console.error("loading js required by widget error:", ROSDASH.connection[i].block.type, ROSDASH.blockDef[ROSDASH.connection[i].block.type].js[j], err.message, err.stack);
			}
		}
	}
	// load required css
	if (ROSDASH.blockDef[ROSDASH.connection[i].block.type] && undefined !== ROSDASH.blockDef[ROSDASH.connection[i].block.type].css)
	{
		for (var j in ROSDASH.blockDef[ROSDASH.connection[i].block.type].css)
		{
			try {
				ROSDASH.loadCss(ROSDASH.blockDef[ROSDASH.connection[i].block.type].js[j]);
			} catch (err)
			{
				ROSDASH.connection[i].error = true;
				console.error("loading css required by widget error:", ROSDASH.connection[i].block.type, ROSDASH.blockDef[ROSDASH.connection[i].block.type].css[j], err.message, err.stack);
			}
		}
	}
}
// wait for loading js
ROSDASH.waitLoadJs = function ()
{
	// if loading finishes or not
	var flag = true;
	for (var i in ROSDASH.loadList)
	{
		// if not loaded
		if (ROSDASH.loadList[i].status < 2 && ROSDASH.loadList[i].status != 0)
		{
			ROSDASH.loadJs(i);
			flag = false;
		}
	}
	if (! flag)
	{
		// wait for loading again
		console.log("wait for loading js");
		setTimeout(ROSDASH.waitLoadJs, 300);
	} else
	{
		// successfully loaded
		ROSDASH.instantiateWidgets();
		ROSDASH.loadPanel(ROSDASH.widgets);
	}
}

// load json and register them
ROSDASH.loadJson = function (file, func)
{
	if (undefined === file || "" == file)
	{
		return;
	}
	// init status
	if (! (file in ROSDASH.jsonLoadList))
	{
		ROSDASH.jsonLoadList[file] = new Object();
	}
	if (undefined === ROSDASH.jsonLoadList[file].status)
	{
		ROSDASH.jsonLoadList[file].status = 0;
		ROSDASH.jsonLoadList[file].type = "json";
	}
	// do not load again
	if (ROSDASH.jsonLoadList[file].status >= 2)
	{
		return;
	}
	$.getJSON(file, function (data, status, xhr)
	{
		ROSDASH.jsonLoadList[file].data = data;
		// if successful, status = 1 + 1
		ROSDASH.jsonLoadList[file].status = 1;
		console.log("load", file);
		if (typeof(func) == "function")
		{
			return func(data);
		}
	})
	.fail(function (jqXHR, textStatus) {
		console.error("fail to load", file, jqXHR, textStatus);
		ROSDASH.jsonLoadList[file].status = -10;
	})
	.always(function () {
		// if not successful, status = 1
		++ ROSDASH.jsonLoadList[file].status;
	});
}
// load js file required by widgets
ROSDASH.loadJs = function (file, func)
{
	if (undefined === file || "" == file)
	{
		return;
	}
	if (undefined === ROSDASH.loadList[file])
	{
		ROSDASH.loadList[file] = new Object();
	}
	if (undefined === ROSDASH.loadList[file].status)
	{
		ROSDASH.loadList[file].status = 0;
		ROSDASH.loadList[file].type = "js";
	}
	// do not load again
	if (ROSDASH.loadList[file].status >= 2)
	{
		return;
	}
	$.getScript(file, function (data, status, jqxhr)
	{
		ROSDASH.loadList[file].data = data;
		ROSDASH.loadList[file].status = 1;
		console.log("load", file);
		if (typeof(func) == "function")
		{
			return func(data);
		}
	}).fail(function (jqxhr, settings, exception)
	{
		ROSDASH.loadList[file].status = -10;
		console.warn("fail to load", file, jqxhr, settings, exception);
	}).always(function() {
		++ ROSDASH.loadList[file].status;
	});
}
// load css file
ROSDASH.loadCss = function (file)
{
	if (undefined === file || "" == file)
	{
		return;
	}
	if (undefined === ROSDASH.loadList[file])
	{
		ROSDASH.loadList[file] = new Object();
	}
	if (undefined === ROSDASH.loadList[file].status)
	{
		ROSDASH.loadList[file].status = 0;
	}
	$('head').append('<link rel="stylesheet" href="' + file + '" type="text/css" />');
	ROSDASH.loadList[file].data = file;
	ROSDASH.loadList[file].type = "css";
	ROSDASH.loadList[file].status = 2;
	console.log("load", file);
}

// transform from raw json into real json, i.e. "true" => true
ROSDASH.transformRawJson = function (json)
{
	for (var i in json)
	{
		if ("true" == json[i])
		{
			json[i] = true;
		} else if ("false" == json[i])
		{
			json[i] = false;
		} else if ("null" == json[i])
		{
			json[i] = null;
		} else if ("undefined" == json[i])
		{
			json[i] = undefined;
		} else if (typeof json[i] == "object" || typeof json[i] == "array")
		{
			json[i] = ROSDASH.transformRawJson(json[i]);
		}
	}
	return json;
}
// download json in a new window
ROSDASH.downloadJson = function (json)
{
	window.open('data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json)), 'Download');
}
// save data to json file in server
//@note PHP will ignore empty json part
ROSDASH.saveJson = function (data, filename)
{
	$.ajax({
		type: "POST",
		url: "rosdash.php",
		dataType: 'json',
		data: {
			func: "saveFile",
			file_name: filename,
			data: data
		},
		success: function( data, textStatus, jqXHR )
		{
			console.log("saveJson successful", filename, data, textStatus, jqXHR.responseText);
			ROSDASH.ee.emitEvent("saveJson");
		},
		error: function(jqXHR, textStatus, errorThrown)
		{
			console.log("saveJson error", filename, jqXHR.responseText, textStatus, errorThrown);
		}
	});
}
// callback for uploading json file
ROSDASH.uploadJson = function (file)
{
	console.log("uploadJson", file);
}


///////////////////////////////////// widget actions (based on sDashboard)


// a list of widgets in the panel
ROSDASH.widgets = new Object();
// add a widget by type, usually a new widget
ROSDASH.addWidgetByType = function (name)
{
	if (! ROSDASH.checkBlockTypeValid(name))
	{
		console.error("widget invalid", name);
		return;
	}
	// set a new count number. don't use getWidgetNum because there is no widget object
	if (undefined === ROSDASH.blockDef[name])
	{
		ROSDASH.blockDef[name] = new Object();
		ROSDASH.blockDef[name].count = 0;
	}
	else if (undefined === ROSDASH.blockDef[name].count)
	{
		ROSDASH.blockDef[name].count = 0;
	} else
	{
		++ ROSDASH.blockDef[name].count;
	}
	var widget = {
		widgetTitle : name + " " + ROSDASH.blockDef[name].count,
		widgetId : name + "-" + ROSDASH.blockDef[name].count,
		number : ROSDASH.blockDef[name].count,
		widgetType : name,
		widgetContent : undefined,
		// set the position of new widget as 0
		pos : 0,
		width: ("width" in ROSDASH.blockDef[name]) ? ROSDASH.blockDef[name].width : ROSDASH.dashConf.widget_width,
		height: ("height" in ROSDASH.blockDef[name]) ? ROSDASH.blockDef[name].height : ROSDASH.dashConf.widget_height,
		header_height: ROSDASH.dashConf.header_height,
		content_height: ROSDASH.dashConf.content_height,
		config: ROSDASH.blockDef[name].config
	};
	// move other widgets backward by one
	for (var i in ROSDASH.widgets)
	{
		++ ROSDASH.widgets[i].pos;
	}
	ROSDASH.addWidget(widget);
	//@todo add to diagram
	if (! (widget.widgetId in ROSDASH.blocks))
	{
		console.debug("add to diagram", widget.widgetId)
		//ROSDASH.addBlockByType(name);
	}
	ROSDASH.ee.emitEvent('change');
}
// add a widget, usually from json
ROSDASH.addWidget = function (def)
{
	// if duplicate widget id
	if (def.widgetId in ROSDASH.widgets)
	{
		console.error("widget id duplicate: ", def.widgetId);
		// show the effect
		$("#" + canvas).sDashboard("addWidget", def);
		return;
	}
	def = ROSDASH.getWidgetNum(def);
	if (undefined === def)
	{
		return;
	}
	// save the definition of this widget
	ROSDASH.widgets[def.widgetId] = def;
	$("#editor").sDashboard("addWidget", def);
	ROSDASH.ee.emitEvent('addWidget');
}
// set the value of widget content
ROSDASH.setWidgetContent = function (widget)
{
	//@deprecated set default value of content into example data from sDashboard
	switch (widget.widgetType)
	{
	case "table":
		widget.widgetContent = {
			"aaData" : [["", "", ""]],
			"aoColumns" : [{
				"sTitle" : ""
			}, {
				"sTitle" : ""
			}, {
				"sTitle" : ""
			}],
			"iDisplayLength": 25,
			"aLengthMenu": [[1, 25, 50, -1], [1, 25, 50, "All"]],
			"bPaginate": true,
			"bAutoWidth": false
		};
		break;
	case "bubbleChart":
	case "bubble chart":
		widget.widgetType = "chart";
		widget.widgetContent = new Object();
		widget.widgetContent.data = myExampleData.bubbleChartData;
		widget.widgetContent.options = myExampleData.bubbleChartOptions;
		break;
	case "pieChart":
	case "pie chart":
		widget.widgetType = "chart";
		widget.widgetContent = new Object();
		widget.widgetContent.data = myExampleData.pieChartData;
		widget.widgetContent.options = myExampleData.pieChartOptions;
		break;
	case "barChart":
	case "bar chart":
		widget.widgetType = "chart";
		widget.widgetContent = new Object();
		widget.widgetContent.data = myExampleData.barChartData;
		widget.widgetContent.options = myExampleData.barChartOptions;
		break;
	case "chart":
	case "lineChart":
	case "line chart":
		widget.widgetType = "chart";
		widget.widgetContent = new Object();
		widget.widgetContent.data = myExampleData.lineChartData;
		widget.widgetContent.options = myExampleData.lineChartOptions;
		break;
	default:
		widget.widgetContent = "";
		break;
	}

	// if widget instantiated
	if (undefined !== ROSDASH.connection[widget.widgetId] && undefined !== ROSDASH.connection[widget.widgetId].instance)
	{
		// set default title from config
		if (undefined !== ROSDASH.connection[widget.widgetId].block && undefined !== ROSDASH.connection[widget.widgetId].block.config && undefined !== ROSDASH.connection[widget.widgetId].block.config.title && "" != ROSDASH.connection[widget.widgetId].block.config.title)
		{
			widget.widgetTitle = ROSDASH.connection[widget.widgetId].block.config.title;
		}
		// the intance of widget
		var obj = ROSDASH.connection[widget.widgetId].instance;
		try {
			// if cannot pass checking, do not run
			if ( ROSDASH.checkFuncByName("addWidget", obj) )
			{
				// execute addWidget
				widget = ROSDASH.runFuncByName("addWidget", obj, widget);
			}
		} catch (err)
		{
			console.error("add widget error", err.message, err.stack);
			return undefined;
		}
	}
	return widget;
}
// set the widget number
ROSDASH.getWidgetNum = function (def)
{
	// if the ROSDASH.blockDef of def.widgetType does not exist - for constant
	if (undefined === ROSDASH.blockDef[def.widgetType])
	{
		ROSDASH.blockDef[def.widgetType] = new Object();
		if (undefined === def.number)
		{
			// init to 0
			ROSDASH.blockDef[def.widgetType].count = 0;
			def.number = ROSDASH.blockDef[def.widgetType].count;
		} else
		{
			ROSDASH.blockDef[def.widgetType].count = def.number;
		}
	}
	else if (undefined === ROSDASH.blockDef[def.widgetType].count)
	{
		if (undefined === def.number)
		{
			// init to 0
			ROSDASH.blockDef[def.widgetType].count = 0;
			def.number = ROSDASH.blockDef[def.widgetType].count;
		} else
		{
			ROSDASH.blockDef[def.widgetType].count = def.number;
		}
	} else if (undefined === def.number)
	{
		++ ROSDASH.blockDef[def.widgetType].count;
		def.number = ROSDASH.blockDef[def.widgetType].count;
	} else if (def.number > ROSDASH.blockDef[def.widgetType].count)
	{
			ROSDASH.blockDef[def.widgetType].count = def.number;
	} else
	{
		// if widget number conflicts
		for (var i in ROSDASH.widgets)
		{
			if (ROSDASH.widgets[i].widgetType == def.widgetType && ROSDASH.widgets[i].number == def.number)
			{
				console.error("widget number conflicted: " + def.widgetId);
				// set a new widget number
				++ ROSDASH.blockDef[def.widgetType].count;
				def.number = ROSDASH.blockDef[def.widgetType].count;
			}
		}
	}
	return def;
}

// remove a widget
ROSDASH.removeWidget = function (id)
{
	var pos = ROSDASH.widgets[id].pos;
	// move widgets behind it forward by one
	for (var i in ROSDASH.widgets)
	{
		if (ROSDASH.widgets[i].pos > pos)
		{
			-- ROSDASH.widgets[i].pos;
		}
	}
	delete ROSDASH.widgets[id];
	ROSDASH.ee.emitEvent('change');
}
// callback function of sDashboard widget move
ROSDASH.moveWidget = function (sorted)
{
	// update all new positions
	for (var i in sorted)
	{
		if (sorted[i].widgetId in ROSDASH.widgets)
		{
			ROSDASH.widgets[sorted[i].widgetId].pos = i;
		}
	}
	ROSDASH.ee.emitEvent('change');
}
ROSDASH.selectedWidget;
ROSDASH.selectWidgetCallback = function (e, data)
{
	ROSDASH.selectedWidget = data.selectedWidgetId;
	var w = ROSDASH.widgets[ROSDASH.selectedWidget];
	// a sidebar for widget json information
	ROSDASH.jsonFormType = "property";
	ROSDASH.formClickBlock(ROSDASH.selectedWidget);
	return w;
}

// get a editable subset property in widget to edit
ROSDASH.getWidgetEditableProperty = function (id)
{
	if (! (id in ROSDASH.widgets))
	{
		return;
	}
	var widget = ROSDASH.widgets[id];
	var property = {
		widgetTitle: widget.widgetTitle,
		width: widget.width,
		height: widget.height,
		header_height: widget.header_height,
		content_height: widget.content_height
	};
	return property;
}

// modify the content of a widget directly
ROSDASH.updateWidgetContent = function (id, content)
{
	$("#dash").sDashboard("setContentById", id, content);
}
ROSDASH.findWidget = function (id)
{
	if (id in ROSDASH.widgets)
	{
		$("#dash").sDashboard("findWidget", id);
	} else
	{
		console.log("cannot find ", id);
	}
}


///////////////////////////////////// blocks in diagram


// a list of configurations for each block
ROSDASH.blocks = new Object();
// add a new ros item block, not add one from init json file
ROSDASH.addRosItem = function (rosname, type)
{
	if ("topic" != type && "service" != type && "param" != type)
	{
		type = "topic";
	}
	//@note maybe i should allow conflict?
	if ("" == rosname || ROSDASH.checkRosConflict(rosname, type))
	{
		console.error("ros item name is not valid: ", rosname);
		return;
	}
	// set the new block location
	var next_pos = ROSDASH.getNextNewBlockPos();
	var x = (typeof x !== "undefined") ? parseFloat(x) : next_pos[0];
	var y = (typeof y !== "undefined") ? parseFloat(y) : next_pos[1];
	var count = ROSDASH.rosBlocks[type].length;
	var id = type + "-" + count;
	// add block body
	var body = window.cy.add({
		group: "nodes",
		data: {
			id: id,
			name: rosname,
			faveColor: 'Gold'
		},
		position: { x: x, y: y },
		classes: "body"
	});
	// add block input pins
	window.cy.add({
		group: "nodes",
		data: {
			id: id + "-i0"
		},
		position: { x: x + ROSDASH.INPUT_POS[1][0][0], y: y + ROSDASH.INPUT_POS[1][0][1] },
		classes: "input",
		locked: true
	});
	// add block output pins
	window.cy.add({
		group: "nodes",
		data: {
			id: id + "-o0"
		},
		position: { x: x + ROSDASH.OUTPUT_POS[1][0][0], y: y + ROSDASH.OUTPUT_POS[1][0][1] },
		classes: "output",
		locked: true
	});
	var block = {
		id: id,
		type: type,
		name: rosname,
		rosname: rosname,
		rostype: '',
		number: ROSDASH.rosBlocks.topic.length,
		x: x,
		y: y
	};
	// set the input of this block
	if (undefined !== ROSDASH.blockDef[type].input)
	{
		// assign by deep copy
		block.input = ROSDASH.blockDef[type].input.slice();
	} else
	{
		block.input = new Array();
	}
	// set the output of this block
	if (undefined !== ROSDASH.blockDef[type].output)
	{
		// assign by copy
		block.output = ROSDASH.blockDef[type].output.slice();
	} else
	{
		block.output = new Array();
	}
	// register the new block
	ROSDASH.blocks[id] = block;
	ROSDASH.rosBlocks[type].push(rosname);
	// return to facilitate "fit"
	return id;
}
// add a new block based on type
ROSDASH.addBlockByType = function (type)
{
	var id = ROSDASH.addBlock({type: type});
	// add a corresponding widget
	if (undefined !== id && (type in ROSDASH.blockDef) && ("has_panel" in ROSDASH.blockDef[type]) && ROSDASH.blockDef[type].has_panel && ! (id in ROSDASH.widgets))
	{
		//ROSDASH.addWidgetByType(type);
	}
	return id;
}
// add a new constant block based on type
ROSDASH.addConstant = function (const_type)
{
	var value = ROSDASH.getMsgDefaultValue(const_type);
	var block = {
		type: "constant",
		constant: true,
		constname: const_type,
		value: value
	};
	return ROSDASH.addBlock(block);
}
ROSDASH.addBlock = function (block)
{
	var block = ROSDASH.initBlockConf(block);
	// if fail to init a block
	if (undefined === block)
	{
		return undefined;
	}
	// determine the block number
	block = ROSDASH.getBlockNum(block, block.list_name);
	// set color by type
	var color = "Aquamarine";
	switch (block.type)
	{
	case "constant":
		color = "Chartreuse";
		break;
	case "topic":
	case "service":
	case "param":
		color = "Gold";
		break;
	}
	// true name for display, compatible with old blocks
	var true_name = ROSDASH.getDisplayName(block);
	// add the body of the block
	var body = window.cy.add({
		group: "nodes",
		data: {
			id: block.id,
			name: true_name, // block.name,
			faveColor: color,
		},
		position: { x: block.x, y: block.y },
		classes: "body"
	});
	// add input pins
	for (var i = 0; i < block.input.length; ++ i)
	{
		window.cy.add({
			group: "nodes",
			data: {
				id: block.id + "-i" + i
			},
			position: { x: block.x + ROSDASH.INPUT_POS[block.input.length][i][0], y: block.y + ROSDASH.INPUT_POS[block.input.length][i][1] },
			classes: "input",
			locked: true
		});
	}
	// add output pins
	for (var i = 0; i < block.output.length; ++ i)
	{
		window.cy.add({
			group: "nodes",
			data: {
				id: block.id + "-o" + i
			},
			position: { x: block.x + ROSDASH.OUTPUT_POS[block.output.length][i][0], y: block.y + ROSDASH.OUTPUT_POS[block.output.length][i][1] },
			classes: "output",
			locked: true
		});
	}
	// save the information of the block into ROSDASH.blocks by id
	ROSDASH.blocks[block.id] = block;
	return block.id;
}

//@todo generate the position for new blocks to be. maybe should follow the mouse
ROSDASH.getNextNewBlockPos = function ()
{
	return [0, 0];
}
// init the configuration of a new block
ROSDASH.initBlockConf = function (block)
{
	if (ROSDASH.checkBlockTypeValid(block.type))
	{
		block.list_name = ("constant" != block.type) ? block.type : block.constname;
		// for ros items
		if ("topic" == block.type || "service" == block.type || "param" == block.type)
		{
			ROSDASH.rosBlocks[block.type].push(block.rosname);
		}
	}
	// for constant
	else if (ROSDASH.checkMsgTypeValid(block.type))
	{
		// should be in front of def.type
		block.list_name = block.type;
		block.constname = block.type;
		block.type = "constant";
		block.constant = true;
		block.value = "";
	} else
	{
		// the widget type is invalid, and the error message is sent from ROSDASH.checkBlockTypeValid
		return undefined;
	}
	// set the input of this block
	if (undefined !== ROSDASH.blockDef[block.type].input)
	{
		// assign by deep copy
		block.input = ROSDASH.blockDef[block.type].input.slice();
	} else
	{
		block.input = new Array();
	}
	// set the output of this block
	if (undefined !== ROSDASH.blockDef[block.type].output)
	{
		// assign by deep copy
		block.output = ROSDASH.blockDef[block.type].output.slice();
	} else
	{
		block.output = new Array();
	}
	if (undefined === block.config)
	{
		// assign config to a block from definition
		if (undefined !== ROSDASH.blockDef[block.type].config)
		{
			block.config = ROSDASH.transformRawJson(ROSDASH.blockDef[block.type].config);
		} else
		{
			block.config = new Object();
		}
		// compulsory config
		block.config.cacheable = block.config.cacheable || false;
		// for a widget
		if (true == ROSDASH.blockDef[block.type].has_panel)
		{
			block.config.title = block.config.title || block.name;
		}
	} else
	{
		// transform config from raw json into real json
		block.config = ROSDASH.transformRawJson(block.config);
	}
	// if no position specified, use the new position for a block
	var next_pos = ROSDASH.getNextNewBlockPos();
	block.x = (typeof block.x != "undefined") ? parseFloat(block.x) : next_pos[0];
	block.y = (typeof block.y != "undefined") ? parseFloat(block.y) : next_pos[1];
	return block;
}
// determine the block number
ROSDASH.getBlockNum = function (block, block_type)
{
	if (typeof block.number == "string")
	{
		block.number = parseInt(block.number);
	}
	// if no block number specified
	if (undefined === block.number)
	{
		// if no count, initialize to zero
		if (undefined === ROSDASH.blockDef[block_type])
		{
			ROSDASH.blockDef[block_type] = new Object();
			ROSDASH.blockDef[block_type].count = 0;
		} else if (undefined === ROSDASH.blockDef[block_type].count)
		{
			ROSDASH.blockDef[block_type].count = 0;
		} else // add the count by one
		{
			++ ROSDASH.blockDef[block_type].count;
		}
		block.number = ROSDASH.blockDef[block_type].count;
		// add id by number
		block.id = block_type + "-" +  ROSDASH.blockDef[block_type].count;
		// if constant, set the name as value
		if ("constant" == block.type && undefined !== block.value)
		{
			if ("array" == typeof block.value || "object" == typeof block.value)
			{
				block.name = JSON.stringify(block.value);
			} else
			{
				block.name = block.value;
			}
		} else // set the name by id
		{
			block.name = block_type + " " +  ROSDASH.blockDef[block_type].count;
		}
	}
	// if no widgetDef, initialize to def.number
	else if (undefined === ROSDASH.blockDef[block_type])
	{
		ROSDASH.blockDef[block_type] = new Object();
		ROSDASH.blockDef[block_type].count = block.number;
	}
	// if no count, initialize to def.number
	else if (undefined === ROSDASH.blockDef[block_type].count)
	{
		ROSDASH.blockDef[block_type].count = 0;
	}
	// if larger than count, set count to def.number
	else if (block.number > ROSDASH.blockDef[block_type].count)
	{
		ROSDASH.blockDef[block_type].count = block.number;
	} else // otherwise, ignore the count
	{
		// test if conflict with other block number
		for (var i in ROSDASH.blocks)
		{
			if (block_type == ROSDASH.blocks[i].type && block.number == ROSDASH.blocks[i].number)
			{
				console.error("block number conflicts: " + block.id);
				return block;
			}
		}
	}
	return block;
}
// get a suitable name displayed in diagram
ROSDASH.getDisplayName = function (block)
{
	var true_name = block.name;
	switch (block.type)
	{
	case "constant":
		if (undefined !== block.value)
		{
			if ("array" == typeof block.value || "object" == typeof block.value)
			{
				true_name = JSON.stringify(block.value);
			} else
			{
				true_name = block.value;
			}
		}
		break;
	case "topic":
	case "service":
	case "param":
		if (undefined !== block.rosname)
		{
			true_name = block.rosname;
		}
		break;
	}
	if (16 < true_name.length)
	{
		true_name = true_name.substring(0, 16 - 3) + "...";
	}
	return true_name;
}


///////////////////////////////////// pins


// input pin position distribution
ROSDASH.INPUT_POS = {
	"1": [[-70, 0]],
	"2": [[-70, -20], [-70, 20]],
	"3": [[-70, -20], [-70, 0], [-70, 20]],
	"4": [[-70, -30], [-70, -10], [-70, 10], [-70, 30]],
	"5": [[-70, -40], [-70, -20], [-70, 0], [-70, 20], [-70, 40]],
	"6": [[-70, -50], [-70, -30], [-70, -10], [-70, 10], [-70, 30], [-70, 50]],
	//@todo more are coming
};
// output pin position distribution
ROSDASH.OUTPUT_POS = {
	"1": [[70, 0]],
	"2": [[70, -20], [70, 20]],
	"3": [[70, -20], [70, 0], [70, 20]],
	"4": [[70, -30], [70, -10], [70, 10], [70, 30]],
	"5": [[70, -40], [70, -20], [70, 0], [70, 20], [70, 40]],
	"6": [[70, -50], [70, -30], [70, -10], [70, 10], [70, 30], [70, 50]],
	//@todo more are coming
};
// get the body name of a pin
ROSDASH.getBlockParent = function (block)
{
	// format: Blockname-TypeNumber
	var index = block.lastIndexOf("-");
	return block.substring(0, index);
}
// get the number of a pin
ROSDASH.getPinNum = function (pin)
{
	// format: Blockname-TypeNumber
	var index = pin.lastIndexOf("-");
	return parseFloat(pin.substring(index + 2));
}
// get the type of a pin
ROSDASH.getPinType = function (pin)
{
	// format: Blockname-TypeNumber
	var index = pin.lastIndexOf("-");
	//@bug 1 is not always true
	return pin.substring(index + 1, 1);
}
// get the type and number of a pin
ROSDASH.getPinTypeNum = function (pin)
{
	// format: Blockname-TypeNumber
	var index = pin.lastIndexOf("-");
	return pin.substring(index + 1);
}
//@todo change the pins of a block
ROSDASH.changePin = function (id, pin_type, action)
{
	// get the block body
	var block = ROSDASH.blocks[ROSDASH.getBlockParent(id)];
	if (undefined === block)
	{
		return;
	}
	var count = 0;
	switch (action)
	{
	case "add":
		for (var i in block[pin_type])
		{
			if ("true" == block[pin_type][i].addKey)
			{
				++ count;
				var tmp = jQuery.extend(true, {}, block[pin_type][i]);
				tmp.addKey = "false";
				block[pin_type].push(tmp);
				window.cy.add({
					group: "nodes",
					data: {
						id: block.id + "-i" + (block[pin_type].length - 1)
					},
					position: { x: block.x, y: block.y },
					classes: pin_type,
					locked: true
				});
			}
		}
		if (count)
		{
			for (var i in block[pin_type])
			{
				window.cy.nodes("#" + block.id + "-" + pin_type.substring(0, 1) + i).position({x : block.x + ROSDASH.INPUT_POS[block[pin_type].length][i][0], y : block.y + ROSDASH.INPUT_POS[block[pin_type].length][i][1]});
			}
		}
		break;
	}
}
ROSDASH.addPin = function (block, type, num)
{
	var pin = block[type][num];
	/*if (! ROSDASH.checkPinDataType(pin.datatype))
	{
		return false;
	}*/
	if ("true" == pin.subordinate || true == pin.subordinate)
	{
		return;
	}
	var pin_pos = ("input" == type) ? ROSDASH.INPUT_POS[block.input.length][num] : ROSDASH.OUTPUT_POS[block.output.length][num]
	window.cy.add({
		group: "nodes",
		data: {
			id: block.id + "-" + type.substring(0, 1) + i,
			height: ROSDASH.PIN_SIZE[0],
			weight: ROSDASH.PIN_SIZE[1],
			faveColor: ROSDASH.PIN_COLOR,
			faveShape: ROSDASH.BLOCK_SHAPE
		},
		position: { x: block.x + pin_pos[0], y: block.y + pin_pos[1] },
		classes: type,
		locked: true
	});
	block[type][num].exist = true;
}


///////////////////////////////////// block actions (cytoscape)


// find block by id or name
ROSDASH.findBlock = function (id)
{
	if (undefined === id || "" == id || " " == id)
	{
		return undefined;
	}
	var block;
	// find by id
	window.cy.nodes("#" + id).each(function (i, ele) {
		block = ele;
	});
	if (undefined === block)
	{
		// find by name
		window.cy.nodes('[name="' + id + '"]').each(function (i, ele) {
			block = ele;
		});
		if (undefined === block)
		{
			console.log("cannot find", id);
		}
	}
	// if find, center to it
	if (undefined !== block)
	{
		block.select();
		window.cy.center(block);
	}
	return block.id;
}
ROSDASH.removeBlock = function (name)
{
	var ele = window.cy.$(':selected');
	var id;
	var type;
	// priority on selected elements
	if (ele.size() > 0 )
	{
		ele.each(function (i, ele)
		{
			// reserve the id
			id = ele.id();
			// remove block from blocks
			if (ele.id() in ROSDASH.blocks)
			{
				// reserve the type
				type = ROSDASH.blocks[ele.id()].type;
				delete ROSDASH.blocks[ele.id()];
			}
			ele.remove();
		});
	}
	// then the block name from the function argument
	else if (undefined !== name && "" != name)
	{
		// first check id
		ele = window.cy.nodes('[id = "' + name + '"]');
		if (0 == ele.size())
		{
			// then check name
			ele = window.cy.nodes('[name = "' + name + '"]');
			if (ele.size() > 0)
			{
				id = ele.id();
			}
		} else
		{
			id = name;
		}
		if (0 < ele.size())
		{
			// remove block from blocks
			if (id in ROSDASH.blocks)
			{
				type = ROSDASH.blocks[id].type;
				delete ROSDASH.blocks[id];
			}
			ele.remove();
		}
	}
	if (undefined === ROSDASH.blockDef[type])
	{
		return;
	}
	// remove pins
	//@note change to ROSDASH.blocks
	for (var i = 0; i < ROSDASH.blockDef[type].input.length; ++ i)
	{
		ROSDASH.removeBlock(id + "-i" + i);
	}
	for (var i = 0; i < ROSDASH.blockDef[type].output.length; ++ i)
	{
		ROSDASH.removeBlock(id + "-o" + i);
	}
	ROSDASH.removeAllPopup();
}

ROSDASH.movingBlock;
// move a block body
ROSDASH.moveBlock = function (id)
{
	// target does not exist
	if (undefined === ROSDASH.blocks[id])
	{
		return;
	}
	// hide input pins
	var pin_num = ROSDASH.blocks[id].input.length;
	for (var i = 0; i < pin_num; ++ i)
	{
		window.cy.nodes('[id = "' + id + "-i" + i + '"]').hide();
	}
	// hide input pins
	pin_num = ROSDASH.blocks[id].output.length;
	for (var i = 0; i < pin_num; ++ i)
	{
		window.cy.nodes('[id = "' + id + "-o" + i + '"]').hide();
	}
	// remove all popups when moving
	ROSDASH.removeAllPopup();
}
// let pins follow body when moving
ROSDASH.followBlock = function (target)
{
	var id = target.id();
	if (! (id in ROSDASH.blocks))
	{
		return;
	}
	// update the position in ROSDASH.blocks
	ROSDASH.blocks[id].x = target.position('x');
	ROSDASH.blocks[id].y = target.position('y');
	var type = ROSDASH.blocks[id].type;
	// input pins follow
	var pin_num = ROSDASH.blocks[id].input.length;
	for (var i = 0; i < pin_num; ++ i)
	{
		window.cy.nodes('[id = "' + id + "-i" + i + '"]').positions(function (j, ele)
		{
			ele.position({
				x: target.position('x') + ROSDASH.INPUT_POS[pin_num][i][0],
				y: target.position('y') + ROSDASH.INPUT_POS[pin_num][i][1]
			});
		}).show();
	}
	// output pins follow
	pin_num = ROSDASH.blocks[id].output.length;
	for (var i = 0; i < pin_num; ++ i)
	{
		window.cy.nodes('[id = "' + id + "-o" + i + '"]').positions(function (j, ele)
		{
			ele.position({
				x: target.position('x') + ROSDASH.OUTPUT_POS[pin_num][i][0],
				y: target.position('y') + ROSDASH.OUTPUT_POS[pin_num][i][1]
			});
		}).show();
	}
}
ROSDASH.blockMoveCallback = function ()
{
	// move the block body
	window.cy.on('position', function(evt)
	{
		if (evt.cyTarget.id() != ROSDASH.movingBlock)
		{
			ROSDASH.movingBlock = evt.cyTarget.id();
			ROSDASH.moveBlock(ROSDASH.movingBlock);
		}
	});
	// when releasing, let pins follow
	window.cy.on('free', function(evt)
	{
		ROSDASH.followBlock(evt.cyTarget);
		ROSDASH.movingBlock = undefined;
	});
}

//  the former one when connecting
ROSDASH.connectFormer = new Object();
// connect two pins
ROSDASH.connectBlocks = function (source, target)
{
	// if source or target does not exist
	var body = ROSDASH.getBlockParent(source);
	var pin_num = ROSDASH.getPinNum(source);
	if (! (body in ROSDASH.blocks) || pin_num >= ROSDASH.blocks[body].output.length)
	{
		console.error("cannot connect: ", source, body);
		return;
	}
	body = ROSDASH.getBlockParent(target);
	var pin_num = ROSDASH.getPinNum(target);
	if (! (body in ROSDASH.blocks) || pin_num >= ROSDASH.blocks[body].input.length)
	{
		console.error("cannot connect: ", target, body);
		return;
	}
	var flag = false;
	// if target has duplicate connection @note maybe a better finding way?
	window.cy.edges().each(function (i, ele)
	{
		if (true == flag)
		{
			return;
		}
		if (ele.source().id() == target || ele.target().id() == target)
		{
			var pin_type = ROSDASH.getPinType(ele.target().id());
			// if input or output. If others (comments, popup, etc), can connect
			if ("i" == pin_type || "o" == pin_type)
			{
				flag = true;
				console.error("duplicate connect: ", ele.source().id(), ele.target().id());
				return;
			}
		}
	});
	if (flag)
	{
		// output error for once
		console.error("duplicate connect: ", target);
		return;
	}
	// add edge
	window.cy.add({
		group: "edges",
		"data": {
		"source": source,
		"target": target,
		"faveColor": "grey",
		"strength": 10
		}
	});
}
ROSDASH.connectBlocksCallback = function ()
{
	window.cy.on('select', function(evt)
	{
		// mark the connect type
		var connect_type = 0;
		if (evt.cyTarget.hasClass("output"))
		{
			connect_type = 1;
		} else if (evt.cyTarget.hasClass("input"))
		{
			connect_type = 2;
		} else
		{
			return;
		}
		// if no former or unselected the former for a while, set the former
		if (undefined === ROSDASH.connectFormer.block || new Date().getTime() - ROSDASH.connectFormer.unselect > 300)
		{
			ROSDASH.connectFormer.block = evt.cyTarget;
			ROSDASH.connectFormer.type = connect_type;
		}
		// can be connected if connect types are different
		else if (undefined != ROSDASH.connectFormer.block && connect_type != ROSDASH.connectFormer.type)
		{
			if (1 == connect_type)
			{
				ROSDASH.connectBlocks(evt.cyTarget.id(), ROSDASH.connectFormer.block.id());
			}
			else if (2 == connect_type)
			{
				ROSDASH.connectBlocks(ROSDASH.connectFormer.block.id(), evt.cyTarget.id());
			}
			ROSDASH.connectFormer.block = undefined;
		} else // connect failed
		{
			ROSDASH.connectFormer.block = undefined;
		}
	});
	// update the unselect time stamp
	window.cy.on('unselect', function(evt)
	{
		ROSDASH.connectFormer.unselect = new Date().getTime();
	});
}

// get a editable subset property in block to edit
ROSDASH.getBlockEditableProperty = function (id)
{
	if (! (id in ROSDASH.blocks))
	{
		return;
	}
	var block = ROSDASH.blocks[id];
	// general property
	var property = {
		x: block.x,
		y: block.y
	};
	// special property
	switch (block.type)
	{
	case "constant":
		property.value = block.value;
		break;
	case "topic":
	case "service":
	case "param":
		property.type = block.type;
		property.rosname = block.rosname;
		property.rostype = block.rostype;
		break;
	default:
	}
	return property;
}

// block selection
ROSDASH.selectedBlock;
// update the sidebar and popups when selected
ROSDASH.selectBlockCallback = function (evt)
{
	// select node
	if (evt.cyTarget.isNode())
	{
		// select pin
		if (evt.cyTarget.hasClass("pin") || evt.cyTarget.hasClass("input") || evt.cyTarget.hasClass("output"))
		{
			ROSDASH.selectedBlock = ROSDASH.getBlockParent(evt.cyTarget.id());
		}
		// select body
		else if (evt.cyTarget.hasClass("body"))
		{
			ROSDASH.selectedBlock = evt.cyTarget.id();
			// add a popup to selected block to show description
			ROSDASH.addBlockPopup(evt.cyTarget.id());
			// a sidebar for block json information
			ROSDASH.jsonFormType = "property";
			ROSDASH.formClickBlock(evt.cyTarget.id());
		}
		// select popup
		else if (evt.cyTarget.hasClass("popup"))
		{
			ROSDASH.selectedBlock = ROSDASH.getBlockParent(evt.cyTarget.id());
			// popup connect
			if (evt.cyTarget.hasClass("pinput") || evt.cyTarget.hasClass("poutput"))
			{
				//@todo popup connect
				console.log("popup connect")
			}
			// change pin
			if (evt.cyTarget.id().substring(evt.cyTarget.id().length - 2) == "-a")
			{
				ROSDASH.changePin(evt.cyTarget.id(), "input", "add");
			}
		}
	} else // select edge
	{
		ROSDASH.selectedBlock = undefined;
		// add a popup to selected edge to show description
		ROSDASH.addEdgePopup(evt.cyTarget);
	}
}


///////////////////////////////////// block popups and comments


// remove all popups when unselected
ROSDASH.removeAllPopup = function ()
{
	// remove previous popups
	cy.$('.popup').each(function (i, ele)
	{
		var id = ROSDASH.getBlockParent(ele.id());
		if ((id in ROSDASH.blocks) && ("popup" in ROSDASH.blocks[id]))
		{
			var tn = ROSDASH.getPinTypeNum(ele.id());
			// remove the name in ROSDASH.blocks[id].popup
			for (var i in ROSDASH.blocks[id].popup)
			{
				if (ROSDASH.blocks[id].popup[i] == tn)
				{
					ROSDASH.blocks[id].popup.splice(i, 1);
					break;
				}
			}
		}
		ele.remove();
	});
}
// add a popup to a pin
ROSDASH.addPinPopup = function (id, pin_type, num)
{
	var block = ROSDASH.blocks[id];
	if (undefined === block[pin_type][num] || undefined === block[pin_type][num].name)
	{
		return;
	}
	// shorthand for pin_type
	var pin_t = pin_type.substring(0, 1);
	var pin_pos = window.cy.nodes('#' + block.id + "-" + pin_t + num).position();
	var text = block[pin_type][num].name;
	window.cy.add({
		group: "nodes",
		data: {
			id: block.id + "-p" + pin_t + num,
			name: text,
			weight: 40,
			height: 80,
			faveShape: "ellipse",
			faveColor: "Cornsilk",
		},
		position: { x: pin_pos.x + (("input" == pin_type) ? -70 : 70), y: pin_pos.y },
		classes: "popup p" + pin_type
	});
	window.cy.add({
		group: "edges",
		"data": {
		"source": block.id + "-p" + pin_t + num,
		"target": block.id + "-" + pin_t + num,
		"strength": 100,
		'target-arrow-shape': 'triangle'
		}
	});
	// add to popup list
	if (id in ROSDASH.blocks && "popup" in ROSDASH.blocks[id])
	{
		ROSDASH.blocks[id].popup.push("p" + pin_t + num);
	}
}
// when a block is clicked, popup descriptions for the block and its inputs and outputs
ROSDASH.addBlockPopup = function (id)
{
	// remove previous popups
	ROSDASH.removeAllPopup();
	var target = ROSDASH.blocks[id];
	if (! ("popup" in ROSDASH.blocks[id]))
	{
		ROSDASH.blocks[id].popup = new Array();
	}
	var text = target.id;
	var discrip_weight = 100;
	// if has description, popup
	if (undefined !== ROSDASH.blockDef[target.type] && undefined !== ROSDASH.blockDef[target.type].descrip)
	{
		text += " : " + ROSDASH.blockDef[target.type].descrip;
		discrip_weight += 300;
	}
	window.cy.add({
		group: "nodes",
		data: {
			id: target.id + "-pd",
			name: text,
			weight: discrip_weight,
			height: 80,
			faveShape: "roundrectangle",
			"faveColor": "Cornsilk",
		},
		position: { x: target.x, y: target.y - 100 },
		classes: "popup"
	});
	window.cy.add({
		group: "edges",
		"data": {
		"source": target.id + "-pd",
		"target": target.id,
		"strength": 100,
		'target-arrow-shape': 'triangle'
		}
	});
	ROSDASH.blocks[id].popup.push("pd");
	// popup names for inputs
	for (var i = 0; i < target.input.length; ++ i)
	{
		ROSDASH.addPinPopup(id, "input", i);
	}
	// popup names for outputs
	for (var i = 0; i < target.output.length; ++ i)
	{
		ROSDASH.addPinPopup(id, "output", i);
	}
	// popup for add a new pin
	for (var i in target.input)
	{
		if ("true" == target.input[i].addKey)
		{
			window.cy.add({
				group: "nodes",
				data: {
					id: target.id + "-pa0",
					name: "add key",
					weight: 100,
					height: 80,
					faveShape: "roundrectangle",
					"faveColor": "Coral",
				},
				position: { x: target.x, y: target.y - 200 },
				classes: "popup"
			});
			window.cy.add({
				group: "edges",
				"data": {
				"source": target.id + "-pa0",
				"target": target.id,
				"strength": 100,
				'target-arrow-shape': 'triangle'
				}
			});
			ROSDASH.blocks[id].popup.push("pa0");
			break;
		}
	}
}
// when an edge is clicked, popup discriptions for both ends
ROSDASH.addEdgePopup = function (edge)
{
	ROSDASH.removeAllPopup();
	var source_id = ROSDASH.getBlockParent(edge.source().id());
	var target_id = ROSDASH.getBlockParent(edge.target().id());
	var source_num = ROSDASH.getPinNum(edge.source().id());
	var target_num = ROSDASH.getPinNum(edge.target().id());
	if (undefined === ROSDASH.blocks[source_id].output[source_num] || undefined === ROSDASH.blocks[target_id].input[target_num])
	{
		return;
	}
	ROSDASH.addPinPopup(source_id, "output", source_num);
	ROSDASH.addPinPopup(target_id, "input", target_num);
}

ROSDASH.commentCount = 0;
// add a comment block by the content
ROSDASH.addBlockComment = function (content)
{
	if (undefined === content)
	{
		return undefined;
	}
	var block = window.cy.add({
		group: "nodes",
		data: {
			id: "c-" + ROSDASH.commentCount,
			name: content,
			weight: 100,
			height: 80,
			faveShape: "roundrectangle",
			faveColor: "Cornsilk",
		},
		position: { x: 0, y: 0 },
		classes: "comment"
	});
	++ ROSDASH.commentCount;
	return "c-" + (ROSDASH.commentCount - 1);
}


///////////////////////////////////// diagram analysis


// connection relationship for diagram
ROSDASH.connection = new Object();
// parse the diagram to obtain the connection relations
ROSDASH.parseDiagram = function (diagram)
{
	// parse block config into true value
	for (var i in diagram.block)
	{
		if (undefined !== diagram.block[i].config)
		{
			diagram.block[i].config = ROSDASH.transformRawJson(diagram.block[i].config);
		}
	}
	// for each edge
	for (var i in diagram.edge)
	{
		var edge = diagram.edge[i];
		// obtain one block of the edge
		var block1 = ROSDASH.getBlockParent(edge.source);
		ROSDASH.initConnection(block1);
		var type1 = ROSDASH.getPinTypeNum(edge.source);
		// obtain the other block of the edge
		var block2 = ROSDASH.getBlockParent(edge.target);
		ROSDASH.initConnection(block2);
		var type2 = ROSDASH.getPinTypeNum(edge.target);
		// save into ROSDASH.connection
		if (type1.substring(0, 1) == "i" && type2.substring(0, 1) == "o")
		{
			ROSDASH.connection[block1].parent[type1] = block2;
			ROSDASH.connection[block1].type[type1] = type2;
		} else if (type1.substring(0, 1) == "o" && type2.substring(0, 1) == "i")
		{
			ROSDASH.connection[block2].parent[type2] = block1;
			ROSDASH.connection[block2].type[type2] = type1;
		}
	}
	// for each block
	for (var i in diagram.block)
	{
		if (undefined === ROSDASH.blockDef[diagram.block[i].type])
		{
			console.warn("invalid block", i);
			continue;
		}
		// if it is not in the connection
		if (undefined === ROSDASH.connection[i])
		{
			// generate that block with no connection
			ROSDASH.initConnection(i);
		}
		// record the block property especially config
		ROSDASH.connection[i].block = diagram.block[i];
		// check if cacheable
		if (("config" in ROSDASH.connection[i].block) && ("cacheable" in ROSDASH.connection[i].block.config) && ROSDASH.connection[i].block.config.cacheable)
		{
			ROSDASH.connection[i].cacheable = true;
		}
		// validate the existence of the block
		ROSDASH.connection[i].exist = true;
		// load required files, i.e. js, css, etc.
		ROSDASH.loadRequired(i);
	}
	setTimeout(ROSDASH.waitLoadJs, 300);
}
// set a new item in diagram connection
ROSDASH.initConnection = function (id)
{
	if (undefined === ROSDASH.connection[id])
	{
		ROSDASH.connection[id] = {
			// parent blocks
			parent : new Object(),
			// type of each connection
			type : new Object(),
			// if exists in diagram blocks
			exist : false,
			// if executed for this cycle
			cycle : -1,
			// if init method succeeds or not
			initialized : false,
			// if in error when running
			error : false,
			// the output of this block
			output : undefined,
			// if new output is the same as previous
			duplicate : false,
			// if allow cache
			cacheable : false,
		};
	}
}
ROSDASH.instantiateWidgets = function ()
{
	// for each block
	for (var i in ROSDASH.connection)
	{
		if (! ROSDASH.connection[i].exist || ROSDASH.connection[i].error)
		{
			continue;
		}
		try {
			ROSDASH.connection[i].instance = ROSDASH.newObjByName(ROSDASH.blockDef[ROSDASH.connection[i].block.type].class_name, ROSDASH.connection[i].block);
		} catch (err)
		{
			ROSDASH.connection[i].error = true;
			console.error("instantiate widget error:", i, ROSDASH.blockDef[ROSDASH.connection[i].block.type].class_name, err.message, err.stack);
		}
		if (undefined === ROSDASH.connection[i].instance)
		{
			ROSDASH.connection[i].error = true;
		}
	}
}


///////////////////////////////////// diagram execution


// new object by a string of name with at most two arguments
ROSDASH.newObjByName = function (name, arg1, arg2)
{
	if (typeof name != "string")
	{
		return undefined;
	}
	// split by . to parse class with namespaces
	var namespaces = name.split(".");
	var class_name = namespaces.pop();
	var context = window;
	// parse namespaces one by one
	for (var i in namespaces)
	{
		context = context[namespaces[i]];
	}
	// if the class is valid
	if(typeof context == "object" && typeof context[class_name] == "function")
	{
		// new an object of the class
		if (undefined === arg1 && undefined === arg2)
		{
			return new context[class_name] ();
		} else if (undefined === arg2)
		{
			return new context[class_name] (arg1);
		} else
		{
			return new context[class_name] (arg1, arg2);
		}
	} else
	{
		console.error("widget instantiation failed: ", class_name, name, arg1, arg2);
		return undefined;
	}
}
// just check, no run
ROSDASH.checkFuncByName = function (name, context)
{
	if (typeof name != "string")
	{
		return false;
	}
	// if context is undfined, it should be window
	context = (undefined !== context) ? context : window;
	// split by . to parse function with namespaces
	var namespaces = name.split(".");
	// parse namespaces one by one
	// cannot put the last function name here, or else that function cannot use class public variables
	for (var i = 0; i < namespaces.length - 1; ++ i)
	{
		context = context[namespaces[i]];
	}
	// if the function is valid
	if(typeof context == "object" && typeof context[namespaces[namespaces.length - 1]] == "function")
	{
		return true;
	} else
	{
		return false;
	}
}
// check and run function by a string of name with at most two arguments
ROSDASH.runFuncByName = function (name, context, arg1, arg2)
{
	if (typeof name != "string")
	{
		return undefined;
	}
	// if context is undfined, it should be window
	context = (undefined !== context) ? context : window;
	// split by . to parse function with namespaces
	var namespaces = name.split(".");
	// parse namespaces one by one
	// cannot put the last function name here, or else that function cannot use class public variables
	for (var i = 0; i < namespaces.length - 1; ++ i)
	{
		context = context[namespaces[i]];
	}
	// if the function is valid
	if(typeof context == "object" && typeof context[namespaces[namespaces.length - 1]] == "function")
	{
		// support 0, 1, 2 arguments
		if (undefined === arg1 && undefined === arg2)
		{
			return context[namespaces[namespaces.length - 1]] ();
		} else if (undefined === arg2)
		{
			return context[namespaces[namespaces.length - 1]] (arg1);
		} else
		{
			return context[namespaces[namespaces.length - 1]] (arg1, arg2);
		}
	} else
	{
		return undefined;
	}
}

// set a block as initialized, manually by developer
ROSDASH.setInitialized = function (id)
{
	if (id in ROSDASH.connection)
	{
		ROSDASH.connection[id].initialized = true;
		return true;
	}
	return false;
}
// call init functions of widgets
ROSDASH.initWidgets = function ()
{
	for (var i in ROSDASH.connection)
	{
		// validate the existence of each block just once
		if (! ROSDASH.connection[i].exist)
		{
			console.error("widget does not exist: ", i);
			continue;
		}
		// if error or already initialized
		if (ROSDASH.connection[i].error || ROSDASH.connection[i].initialized)
		{
			continue;
		}
		// check if required js is ready
		if (undefined !== ROSDASH.blockDef[ROSDASH.connection[i].block.type].js)
		{
			var flag = false;
			for (var j in ROSDASH.blockDef[ROSDASH.connection[i].block.type].js)
			{
				if ( ROSDASH.loadList[ROSDASH.blockDef[ROSDASH.connection[i].block.type].js[j]] < 0 )
				{
					//ROSDASH.connection[i].error = true;
				}
				if ( ROSDASH.loadList[ROSDASH.blockDef[ROSDASH.connection[i].block.type].js[j]] < 2 )
				{
					flag = true;
					break;
				}
			}
			// if not ready
			if (flag)
			{
				continue;
			}
		}
		if (undefined !== ROSDASH.connection[i].instance)
		{
			// run function by instance of widget class
			ROSDASH.callWidgetInit(i);
			// if ros connected
			if (ROSDASH.rosConnected && ROSDASH.cycle < 0)
			{
				try	{
					// run initRos
					var initialized = ROSDASH.runFuncByName("initRos", ROSDASH.connection[i].instance);
					// works in chrome 31
					if (false != ROSDASH.connection[i].initialized)
					{
						ROSDASH.connection[i].initialized = initialized;
					 }
				} catch (err)
				{
					console.error("widget initRos error:", i, err.message, err.stack);
				}
			}
			if (undefined === ROSDASH.connection[i].initialized)
			{
				ROSDASH.connection[i].initialized = true;
			}
		}
	}
	ROSDASH.runStatus = "initialized";
}
ROSDASH.callWidgetInit = function (id)
{
	try
	{
		ROSDASH.connection[id].initialized = ROSDASH.runFuncByName("init", ROSDASH.connection[id].instance);
	} catch (err)
	{
		console.error("widget init error:", id, err.message, err.stack);
	}
}

ROSDASH.runStatus = "uninitialized";
ROSDASH.doneCount = 0;
// cycles executed in ROSDASH
ROSDASH.cycle = -1;
ROSDASH.runWidgets = function ()
{
	// count how many cycles executed
	++ ROSDASH.cycle;
	ROSDASH.ee.emitEvent("cycleBegin");
	ROSDASH.runStatus = "running";
	ROSDASH.doneCount = 0;
	var last_count = -1;
	// if ROSDASH.doneCount does not change, the diagram execution ends
	while (last_count < ROSDASH.doneCount)
	{
		last_count = ROSDASH.doneCount;
		// for all blocks
		for (var i in ROSDASH.connection)
		{
			// if in error
			if (! ROSDASH.connection[i].exist || ROSDASH.connection[i].error)
			{
				continue;
			}
			// if done
			if (ROSDASH.connection[i].cycle == ROSDASH.cycle)
			{
				continue;
			}
			// check if widget initialization succeeded
			if (false == ROSDASH.connection[i].initialized)
			{
				if (ROSDASH.cycle < 30)
				{
					console.log("widget init again", i);
					//ROSDASH.widgetInit(i);
					ROSDASH.initWidgets();
				}
				continue;
			}
			var ready_flag = true;
			var duplicate_flag = true;
			var input = new Array();
			// for all the parents of this block
			for (var j in ROSDASH.connection[i].parent)
			{
				// if a parent is not ready
				if (! (ROSDASH.connection[i].parent[j] in ROSDASH.connection) || undefined === ROSDASH.connection[ROSDASH.connection[i].parent[j]].output || ROSDASH.connection[ROSDASH.connection[i].parent[j]].cycle < ROSDASH.cycle)
				{
					ready_flag = false;
					break;
				} else
				{
					if (! ROSDASH.connection[ROSDASH.connection[i].parent[j]].duplicate)
					{
						duplicate_flag = false;
					}
					// get the corresponding order of this input
					var count = parseInt(j.substring(1));
					// save this input by deep copy
					//@bug should not _.clone(), should be specified in config
					input[count] = ROSDASH.connection[ROSDASH.connection[i].parent[j]].output[ROSDASH.connection[i].type[j]];
				}
			}
			// if the block is ready to be execute with all the inputs are ready
			if (ready_flag)
			{
				// run the widget, and save the output into ROSDASH.diagram_output
				if (undefined !== ROSDASH.connection[i].instance)
				{
					// the object of widget class
					var obj = ROSDASH.connection[i].instance;
					try
					{
						// if duplicate and cacheable, don't run
						if (! duplicate_flag || ! ROSDASH.connection[i].cacheable)
						{
							var output = ROSDASH.runFuncByName("run", obj, input);
							// check if duplicate output
							if (_.isEqual(output, ROSDASH.connection[i].output))
							{
								ROSDASH.connection[i].duplicate = true;
							} else
							{
								ROSDASH.connection[i].output = output;
							}
						} else
						{
							//console.log("duplicate and cacheable", i);
						}
						ROSDASH.connection[i].cycle = ROSDASH.cycle;
						ROSDASH.connection[i].error = false;
						++ ROSDASH.doneCount;
					} catch (err)
					{
						console.error("widget runs in error:", i, err.message, err.stack);
						ROSDASH.connection[i].error = true;
					}
				}
				else
				{
					console.error("widget object is not created", i);
					continue;
				}
			}
		}
	}
	ROSDASH.ee.emitEvent("cycleEnd");
	switch (ROSDASH.runStatus)
	{
	case "pause":
	case "stop":
		// don't run
		break;
	default:
		// sleep for a while and start next cycle
		setTimeout(ROSDASH.runWidgets, ROSDASH.dashConf.run_msec);
		break;
	}
}


///////////////////////////////////// ROS


// the instance of ROS connection
ROSDASH.ros;
// ROS connected or not
ROSDASH.rosConnected = false;
// connect with ROS by roslibjs
ROSDASH.connectROS = function (host, port)
{
	// don't need ROS
	if (typeof host === "undefined" || "" == host || " " == host)
	{
		return;
	}
	// default value for port
	port = (typeof port !== "undefined" && "" != port && " " != port) ? port : "9090";
	// close original ROS connection
	if (ROSDASH.rosConnected || undefined !== ROSDASH.ros)
	{
		ROSDASH.ros.close();
	}
	// if not close, wait until close
	if (undefined !== ROSDASH.ros)
	{
		console.log("waiting for ROS connection close");
		setTimeout(function () {
			ROSDASH.connectROS(host, port);
		}, 200);
		return;
	}
	// create a ROS
	ROSDASH.ros = new ROSLIB.Ros();
	ROSDASH.ros.on('error', function(error) {
		console.error("ROS connection error", host, port, error);
		ROSDASH.rosConnected = false;
	});
	ROSDASH.ros.on('connection', function() {
		ROSDASH.rosConnected = true;
		console.log('ROS connection made', host + ":" + port);
		ROSDASH.addToolbarRosValue();
		ROSDASH.getROSNames(ROSDASH.ros);
		// wait until all widgets are ready
		if (ROSDASH.cycle >= 0)
		{
			// emit event for ros connected
			ROSDASH.ee.emitEvent('rosConnected');
		}
	});
	ROSDASH.ros.on('close', function() {
		ROSDASH.rosConnected = false;
		console.log('ROS connection closed', host + ":" + port);
		ROSDASH.ros = undefined;
		// emit event for ros connected
		ROSDASH.ee.emitEvent('rosClosed');
	});
	// connect ROS
	ROSDASH.ros.connect('ws://' + host + ':' + port);
}

// ROS item list for sidebar
ROSDASH.rosNames = {
	topic: {"_": new Array()},
	service: {"_": new Array()},
	param: {"_": new Array()}
};
// get existing ROS names from roslibjs
ROSDASH.getROSNames = function (ros)
{
	ros.getTopics(function (topics)
	{
		// deep copy
		ROSDASH.rosNames.topic["_"] = $.extend(true, [], topics);
	});
	ros.getServices(function (services)
	{
		ROSDASH.rosNames.service["_"] = $.extend(true, [], services);
	});
	ros.getParams(function (params)
	{
		ROSDASH.rosNames.param["_"] = $.extend(true, [], params);
	});
}
// check if the name is an existing ROS item name
ROSDASH.checkRosNameExisting = function (name, type)
{
	var array;
	switch (type)
	{
	case "service":
		array = ROSDASH.rosNames.service["_"];
		break;
	case "param":
		array = ROSDASH.rosNames.param["_"];
		break;
	case "topic":
	default:
		// default is topic
		array = ROSDASH.rosNames.topic["_"];
		break;
	}
	return (jQuery.inArray(name, array) != -1);
}

// ROS blocks in the diagram
ROSDASH.rosBlocks = {
	topic: new Array(),
	service: new Array(),
	param: new Array()
};
// if conflict with existing ROS blocks
ROSDASH.checkRosConflict = function (name, type)
{
	type = (type in ROSDASH.rosBlocks) ? type : "topic";
	return (-1 != jQuery.inArray(name, ROSDASH.rosBlocks[type]));
}


///////////////////////////////////// user configuration @deprecated


// user configuration
ROSDASH.userConf = {
	// basic
	version: "0.1",
	name: "Guest",
	discrip: "",
	auth_info: new Object(),

	// ros
	ros_host: "",
	ros_port: "",

	// files
	panel_names: [],
	js: [],
	css: [],
	json: [],

	// panel
	disable_selection: true,
	run_msec: 200,
	widget_width: 400,
	widget_height: 230,
	header_height: 16,
	content_height: 180
};
// save user name into ROSDASH.userConf and cookie
ROSDASH.setUser = function (user)
{
	/*var json_info = new Object();
	try {
		json_info = JSON.parse(auth_info);
	} catch (e) {
		return;
	}
	if (! ("profile" in json_info) || ! ("displayName" in json_info["profile"]))
	{
		console.error("user name error", json_info);
		return;
	}
	ROSDASH.userConf.auth_info = json_info;
	var user = json_info.profile.displayName;
	*/
	if (undefined !== user && "" != user)
	{
		ROSDASH.userConf.name = user;
	}
	ROSDASH.setCookie("username", ROSDASH.userConf.name);
	ROSDASH.ee.emitEvent("userLogin");
}
// save to cookie
ROSDASH.setCookie = function (c_name, value)
{
	var exdays = 1;
	var exdate = new Date();
	exdate.setDate(exdate.getDate() + exdays);
	var c_value = encodeURI(value) + ((exdays==null) ? "" : "; expires=" + exdate.toUTCString());
	document.cookie = c_name + "=" + c_value;
}
// get value from cookie
ROSDASH.getCookie = function (c_name)
{
	var c_value = document.cookie;
	var c_start = c_value.indexOf(" " + c_name + "=");
	if (c_start == -1)
	{
		c_start = c_value.indexOf(c_name + "=");
	}
	if (c_start == -1)
	{
		c_value = null;
	}
	else
	{
		c_start = c_value.indexOf("=", c_start) + 1;
		var c_end = c_value.indexOf(";", c_start);
		if (c_end == -1)
		{
			c_end = c_value.length;
		}
		c_value = decodeURI(c_value.substring(c_start,c_end));
	}
	return c_value;
}
// check username from cookie
ROSDASH.checkCookie = function ()
{
	var username = ROSDASH.getCookie("username");
	if (username!=null && username!="")
	{
		return username;
	}
}
// log out and remove cookie
ROSDASH.logOut = function ()
{
	ROSDASH.setCookie("username", "");
	ROSDASH.ee.emitEvent("userLogOut");
	return "";
}
