// ==UserScript==
// @id             crosslinks-enhancements
// @name           Crosslinks Enhancements
// @description    Adds options to limit cross links detection by drawn items color and to cross links inside a polygon
// @category       Misc
// @version        1.3
// @author         MarcioPG
// @website        https://github.com/manierim/crosslinks-enhancements
// @updateURL      https://github.com/manierim/crosslinks-enhancements/raw/master/crosslinks-enhancements.meta.js
// @downloadURL    https://github.com/manierim/crosslinks-enhancements/raw/master/crosslinks-enhancements.user.js
// @namespace      https://github.com/manierim
// @match          https://intel.ingress.com/*
// @grant          none
// @require        https://cdn.rawgit.com/hayeswise/Leaflet.PointInPolygon/v1.0.0/wise-leaflet-pip.js
// ==/UserScript==

function wrapper() {

    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== 'function') window.plugin = function () { };

    // PLUGIN START ////////////////////////////////////////////////////////

    window.plugin.crossLinksEnhancements = function () { };
    var $plugin = window.plugin.crossLinksEnhancements;

    //-------------------------------------------------------------
    // Setup
    //-------------------------------------------------------------

    var setup = function () {


        $plugin.ui.init();
        if (window.iitcLoaded !== undefined && window.iitcLoaded) {
            $plugin.init();
        }
        else {
            window.addHook('iitcLoaded', $plugin.init);
        }

    }

    //-------------------------------------------------------------
    // Init 
    //-------------------------------------------------------------

    $plugin.init = function () {

        if (window.plugin.crossLinks === undefined) {
            console.warn('crossLinks Enhancements: crossLinks plugin not found');
            $plugin.ui.remove();
            return;
        }

        $plugin.opts.init();
        $plugin.crossLinks.init();
        $plugin.draw.init();

    }

    //-------------------------------------------------------------
    // Storage 
    //-------------------------------------------------------------
    $plugin.storage = {};

    $plugin.storage.prefix = 'plugin-crosslinks-enhancements.';

    $plugin.storage.put = function (key, object) {

        if (object.polygon) {
            object.polygon = JSON.stringify(object.polygon.getLatLngs());
        }

        localStorage.setItem($plugin.storage.prefix + key, JSON.stringify(object));
    }

    $plugin.storage.get = function (key) {

        if (string = localStorage.getItem($plugin.storage.prefix + key)) {
            object = JSON.parse(string);
            if (object.polygon) {

                var saved = object.polygon;
                object.polygon = null;

                var colorsAndPolygons = $plugin.draw.colorsAndPolygons();

                colorsAndPolygons.polygons.forEach(function (poly) {
                    if (JSON.stringify(poly.getLatLngs()) === saved) {
                        object.polygon = poly;
                    }
                });

            }
            return object;
        }

        return null;
    }


    //-------------------------------------------------------------
    // Options 
    //-------------------------------------------------------------
    $plugin.opts = {};

    $plugin.opts.refreshed = function () {
        $plugin.crossLinks.refresh();
        $plugin.destroyedLinks.refresh();
    }

    $plugin.opts.init = function () {
        if (opts = $plugin.storage.get('opts')) {
            $plugin.opts.set(opts, true);
        }
    }

    $plugin.opts.set = function (opts, firstload) {

        if (firstload == undefined) {
            firstload = false;
        }

        var mustRefresh = $plugin.filters.colors.set(opts.colors);

        if ($plugin.filters.polygon.set(opts.polygon)) {
            mustRefresh = true;
        }

        if (mustRefresh && !firstload) {
            $plugin.opts.refreshed();
        }

        if (!firstload) {
            $plugin.storage.put('opts', opts);
        }

    }

    //-------------------------------------------------------------
    // Draw
    //-------------------------------------------------------------
    $plugin.draw = {};

    $plugin.draw.event = function (e) {

        var refresh = false;

        if (e.event === 'layersDeleted'
            && $plugin.filters.polygon.selected
            && plugin.drawTools.drawnItems._layers[$plugin.filters.polygon.selected._leaflet_id] === undefined
        ) {
            // è stato cancellato il poligono selezionato!
            refresh = $plugin.filters.polygon.set(null);
        }
        else if (e.event == 'layersEdited'
            && $plugin.filters.polygon.selected
        ) {
            var newJson = JSON.stringify($plugin.filters.polygon.selected.getLatLngs());
            if (string = localStorage.getItem($plugin.storage.prefix + 'opts')) {
                object = JSON.parse(string);
                if (object.polygon) {

                    var oldJson = object.polygon;
                    if (oldJson != newJson) {
                        $plugin.filters.polygon._cachedlinkGuids = {};
                        refresh = true;
                    }
                }
            }
        }

        if (refresh) {
            $plugin.opts.refreshed();
            $plugin.storage.put('opts', opts);
        }
    }

    $plugin.draw.init = function () {
        addHook('pluginDrawTools', $plugin.draw.event);
    };

    $plugin.draw.colorsAndPolygons = function () {

        colorsAndPolygons = {
            colors: [],
            polygons: [],
        };

        for (var i in plugin.drawTools.drawnItems._layers) { // leaflet don't support breaking out of the loop

            var layer = plugin.drawTools.drawnItems._layers[i];

            var color = layer.options.color;

            if (colorsAndPolygons.colors.indexOf(color) === -1) {
                colorsAndPolygons.colors.push(color);
            }

            if (layer instanceof L.GeodesicPolygon) {
                colorsAndPolygons.polygons.push(layer)
            }
        };

        return colorsAndPolygons;
    };

    //-------------------------------------------------------------
    // Filtering
    //-------------------------------------------------------------

    $plugin.filters = {};

    //-------------------------------------------------------------
    // Filtering - Colors
    //-------------------------------------------------------------

    $plugin.filters.colors = {};

    $plugin.filters.colors.modes = {
        ONLY_SELECTED: 'ONLY_SELECTED',
        EXCLUDE_SELECTED: 'EXCLUDE_SELECTED'
    };
    $plugin.filters.colors.mode = $plugin.filters.colors.modes.EXCLUDE_SELECTED;

    $plugin.filters.colors.selected = [];

    $plugin.filters.colors.set = function (opts) {

        var mustRefresh = true;

        var delta = opts.selected.filter(function (newcolor) {
            return $plugin.filters.colors.selected.indexOf(newcolor) === -1
        });

        if (!delta.length) {

            delta = $plugin.filters.colors.selected.filter(function (oldcolor) {
                return opts.selected.indexOf(oldcolor) === -1
            });

            if (!delta.length) {
                mustRefresh = false;
            }
        }

        if (mustRefresh) {
            $plugin.filters.colors.selected = opts.selected;
        }

        if ($plugin.filters.colors.mode != $plugin.filters.colors.modes[opts.mode]) {
            $plugin.filters.colors.mode = $plugin.filters.colors.modes[opts.mode];
            if (
                $plugin.filters.colors.selected.length
            ) {
                mustRefresh = true;
            }
        }

        return mustRefresh;

    }

    $plugin.filters.colors.shouldCheckDrawnItem = function (drawItem) {

        // drawn item color filter
        if (
            $plugin.filters.colors.selected.length
            && (
                (
                    $plugin.filters.colors.mode === $plugin.filters.colors.modes.EXCLUDE_SELECTED
                    && $plugin.filters.colors.selected.indexOf(drawItem.options.color) !== -1
                )
                || (
                    $plugin.filters.colors.mode === $plugin.filters.colors.modes.ONLY_SELECTED
                    && $plugin.filters.colors.selected.indexOf(drawItem.options.color) === -1
                )
            )
        ) {
            return false;
        }

        return true;
    }

    //-------------------------------------------------------------
    // Filtering - polygon
    //-------------------------------------------------------------

    $plugin.filters.polygon = {};

    $plugin.filters.polygon.selected = null;
    $plugin.filters.polygon._cachedlinkGuids = {};

    $plugin.filters.polygon.set = function (polygon) {

        var changed = false;
        if (polygon) {
            if (
                (!$plugin.filters.polygon.selected)
                || $plugin.filters.polygon.selected !== polygon
            ) {
                $plugin.filters.polygon.selected = polygon;
                changed = true;
            }
        }
        else if ($plugin.filters.polygon.selected) {
            $plugin.filters.polygon.selected = null;
            changed = true;
        }

        if (changed) {
            $plugin.filters.polygon._cachedlinkGuids = {};
        }
        return changed;
    }

    $plugin.filters.polygon.ShouldCheckLink = function (link) {

        var shouldCheckLink = true;

        if ($plugin.filters.polygon.selected) {

            if ($plugin.filters.polygon._cachedlinkGuids[link.options.guid] === undefined) {

                var linkLatLongs = link.getLatLngs();
                if (
                    $plugin.filters.polygon.selected.contains(linkLatLongs[0])
                    || $plugin.filters.polygon.selected.contains(linkLatLongs[1])
                ) {
                    $plugin.filters.polygon._cachedlinkGuids[link.options.guid] = true;
                }
                else {
                    $plugin.filters.polygon._cachedlinkGuids[link.options.guid]
                        = $plugin.crossLinks.overridenFunctions.testPolyLine($plugin.filters.polygon.selected, link, true);
                }
            }
            shouldCheckLink = $plugin.filters.polygon._cachedlinkGuids[link.options.guid];
        }

        return shouldCheckLink;

    }

    //-------------------------------------------------------------
    // Destroyed Links Simulator integration
    //-------------------------------------------------------------
    $plugin.destroyedLinks = {};

    $plugin.destroyedLinks.refresh = function () {
        if (window.plugin.destroyedLinks !== undefined) {
            window.plugin.destroyedLinks.cross.removeCrossAll();
        }
    }

    //-------------------------------------------------------------
    // Crosslinks integration
    //-------------------------------------------------------------

    $plugin.crossLinks = {};

    $plugin.crossLinks.refresh = function () {
        window.plugin.crossLinks.checkAllLinks();
    }

    $plugin.crossLinks.overridenFunctions = {};

    // Main override for drawn item against link
    $plugin.crossLinks.testPolyLine = function (drawItem, link, closed) {

        if (!$plugin.filters.colors.shouldCheckDrawnItem(drawItem)) {
            return false;
        }
        if (!$plugin.filters.polygon.ShouldCheckLink(link)) {
            return false;
        }
        return $plugin.crossLinks.overridenFunctions.testPolyLine(drawItem, link, closed);
    }

    $plugin.crossLinks.init = function () {

        $plugin.crossLinks.overridenFunctions.testPolyLine = window.plugin.crossLinks.testPolyLine;
        window.plugin.crossLinks.testPolyLine = $plugin.crossLinks.testPolyLine;

        // Recolor Drawn Items fix: color changes do not trigger crosslink updates
        map.on('draw:recolored', function (e) {
            $plugin.opts.refreshed();
        });

    }

    //-------------------------------------------------------------
    // UI
    //-------------------------------------------------------------

    $plugin.ui = {};

    $plugin.ui.init = function () {

        $('#toolbox')
            .append(
                '<a id="crossLinksEnhancementsToolBoxLink" onclick="window.plugin.crossLinksEnhancements.ui.showOptions(); return false;">'
                + 'Cross Links Opts'
                + '</a>'
            );
    }

    $plugin.ui.remove = function () {
        $('#crossLinksEnhancementsToolBoxLink').remove();
    }

    $plugin.ui.setOptions = function () {

        $plugin.ui.resetPolys();

        var opts = {
            colors: {}
        };

        opts.colors.selected = [];

        $("#dialog-crossLinksEnhancementsOptions input[type=checkbox][name=crossLinkColors]").each(function (i, input) {

            if (input.checked) {
                opts.colors.selected.push(input.value);
            }
        });

        opts.colors.mode = null;

        $("#dialog-crossLinksEnhancementsOptions input[type=radio][name=crossLinkColorsMode]").each(function (i, input) {

            if (input.checked) {
                opts.colors.mode = input.value;
            }
        });

        opts.polygon = null;

        input = $("#dialog-crossLinksEnhancementsOptions select[name=crossLinkPolygon]");
        if (input.length && input[0].value !== '') {
            opts.polygon = plugin.drawTools.drawnItems._layers[parseInt(input[0].value)];
            if (opts.polygon === undefined) {
                opts.polygon = null;
            }
        }

        $plugin.opts.set(opts);
    }


    $plugin.ui.stylesCache = [];

    $plugin.ui.resetPolys = function ($exclude_leaflet_id) {

        for (leaflet_id in $plugin.ui.stylesCache) {
            if ($exclude_leaflet_id !== leaflet_id) {
                window.plugin.drawTools.drawnItems._layers[leaflet_id].setStyle($plugin.ui.stylesCache[leaflet_id]);
                delete $plugin.ui.stylesCache[leaflet_id];
            }
        }

    }

    $plugin.ui.previewPoligon = function (leaflet_id) {

        $plugin.ui.resetPolys(leaflet_id);

        if (leaflet_id != '') {
            var poly = window.plugin.drawTools.drawnItems._layers[leaflet_id];
            $plugin.ui.stylesCache[leaflet_id] = {
                'fill': poly.options.fill,
                'fillColor': poly.options.fillColor,
                'fillOpacity': poly.options.fillOpacity,
            };
            poly.setStyle({
                'fill': true,
                'fillColor': '#ff0000',
                'fillOpacity': 0.6,
            })
        }

    }

    $plugin.ui.showOptions = function () {

        var html = [];
        var colorsAndPolygons = $plugin.draw.colorsAndPolygons();

        html.push('<div class="crossLinksEnhancementsStyles">');

        /**
         * -------------------------------------------------------------
         * Colors Filter
         * -------------------------------------------------------------
         */
        html.push('<fieldset>');
        html.push('<legend>Drawn items color:</legend>');

        // Colors selection

        if (colorsAndPolygons.colors.length) {
            colorsAndPolygons.colors.forEach(function (color) {
                var domId = "crossLinkColors_" + color;
                html.push('<input ');
                html.push('type="checkbox" ');
                html.push('name="crossLinkColors" ');
                html.push('id="' + domId + '"');
                if ($plugin.filters.colors.selected.indexOf(color) !== -1) {
                    html.push('checked ');
                }
                html.push('value="' + color + '">');
                html.push('<label for="' + domId + '"><span style="color: ' + color + ';">█</span></label>');
                html.push('&nbsp;&nbsp;&nbsp;&nbsp;');
            });
            html.push('</fieldset>');

            // Colors mode selection

            html.push('<fieldset>');
            html.push('<legend>For above selected colors:</legend>');

            // Colors mode EXCLUDE_SELECTED
            var domId = "crossLinkColorMode_EXCLUDE_SELECTED";
            html.push('<input ');
            html.push('type="radio" ');
            html.push('name="crossLinkColorsMode" ');
            html.push('id="' + domId + '"');
            if ($plugin.filters.colors.mode == $plugin.filters.colors.modes.EXCLUDE_SELECTED) {
                html.push('checked ');
            }
            html.push('value="EXCLUDE_SELECTED">');
            html.push('<label for="' + domId + '">do not show cross links for them</label>');


            // Colors mode ONLY_SELECTED
            var domId = "crossLinkColorMode_ONLY_SELECTED";
            html.push('<br>');
            html.push('<input ');
            html.push('type="radio" ');
            html.push('name="crossLinkColorsMode" ');
            html.push('id="' + domId + '"');
            if ($plugin.filters.colors.mode == $plugin.filters.colors.modes.ONLY_SELECTED) {
                html.push('checked ');
            }
            html.push('value="ONLY_SELECTED">');
            html.push('<label for="' + domId + '">show only cross links for them</label>');


        }
        else {
            html.push('<em>Load a draw or wait first map update!</em>');
        }
        html.push('</fieldset>');

        if (colorsAndPolygons.colors.length) {
            /**
             * -------------------------------------------------------------
             * Polygon Filter
             * -------------------------------------------------------------
             */
            html.push('<fieldset>');
            html.push('<legend>Drawn polygon:</legend>');

            // Polygon selection
            if (colorsAndPolygons.polygons.length) {

                html.push('<select ');
                html.push('name="crossLinkPolygon" ');
                html.push('onchange="window.plugin.crossLinksEnhancements.ui.previewPoligon(this.value);"');
                html.push('>');
                html.push('<option ');
                if (!$plugin.filters.polygon.selected) {
                    html.push('selected ');
                }
                html.push('value></option>');

                colorsAndPolygons.polygons.forEach(function (poly) {

                    html.push('<option ');
                    html.push('value="' + poly._leaflet_id + '"');
                    if (
                        $plugin.filters.polygon.selected
                        && poly === $plugin.filters.polygon.selected
                    ) {
                        $plugin.ui.previewPoligon(poly._leaflet_id);
                        html.push('selected ');
                    }
                    html.push('>');
                    html.push(
                        poly.options.color
                        + ": "
                        + poly.getLatLngs().length
                        + " vertexes"
                    );

                    html.push('</option>');

                });

                html.push('</select>');

            } else {
                html.push('<em>Draw does not contain polygons</em>');
            }

            html.push('</fieldset>');
        }

        html.push('</div>');
        dialog({
            html: html.join(''),
            title: 'Cross Links Options',
            id: 'crossLinksEnhancementsOptions',
            closeCallback: function () { window.plugin.crossLinksEnhancements.ui.setOptions(); }
        });
    }

    // PLUGIN END //////////////////////////////////////////////////////////

    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded && typeof setup === 'function') setup();

}
// WRAPPER END /////////////////////////////////////////////////////////////

// inject code into site context ///////////////////////////////////////////

var script = document.createElement('script');
script.appendChild(document.createTextNode('(' + wrapper + ')();'));
(document.body || document.head || document.documentElement).appendChild(script);
