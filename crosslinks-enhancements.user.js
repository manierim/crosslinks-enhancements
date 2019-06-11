// MarcioPG WRAPPER v1.0 START /////////////////////////////////////////////

function wrapper() {

    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== 'function') window.plugin = function () { };

    // PLUGIN START ////////////////////////////////////////////////////////

    window.plugin.crossLinksEnhancements = function () { };
    $plugin = window.plugin.crossLinksEnhancements;

    //-------------------------------------------------------------
    // Init & Setup
    //-------------------------------------------------------------


    $plugin.initDone = false;
    $plugin.init = function () {

        if ($plugin.initDone) {
            return;
        }
        $plugin.initDone = true;

        if (window.plugin.crossLinks === undefined) {
            console.warn('crossLinks Enhancements: crossLinks plugin not found');
            return;
        }

        $plugin.crossLinks.init();

        $plugin.ui.init();

    }

    var setup = function () {

        if (window.iitcLoaded) {
            $plugin.init();
        }
        else {
            window.addHook('iitcLoaded', $plugin.init);
        }

    }

    //-------------------------------------------------------------
    // Filtering
    //-------------------------------------------------------------

    $plugin.selectedColors = [];
    $plugin.drawcolors = [];

    $plugin.polygons = [];

    $plugin.ShouldCheckDrawnItem = function (drawItem, closed) {

        if ($plugin.drawcolors.indexOf(drawItem.options.color) === -1) {
            $plugin.drawcolors.push(drawItem.options.color);
        }

        if (closed !== undefined && closed
            && $plugin.polygons.indexOf(drawItem._leaflet_id) === -1
        ) {
            /** @todo
             * must save the stringified drawItem.getLatLngs()
             * to find the new _leaflet_id upon reload!
             */

            $plugin.polygons.push(drawItem._leaflet_id);

            if (drawItem._leaflet_id === $plugin.onlyForPolygonWithLeafletId) {
                $plugin.onlyForPolygon = drawItem;
            }
        }

        if ($plugin.selectedColors.indexOf(drawItem.options.color) === -1) {
            return false;
        }
        return true;
    }

    $plugin.onlyForPolygonWithLeafletId = 170;
    $plugin.onlyForPolygon = null;
    $plugin.linkLeafletGuidsChecked = {};

    $plugin.ShouldCheckLink = function (link) {

        var shouldCheckLink = true;

        if ($plugin.onlyForPolygon) {

            if ($plugin.linkLeafletGuidsChecked[link.options.guid] === undefined) {

                var linkLatLongs = link.getLatLngs();
                if (
                    $plugin.onlyForPolygon.contains(linkLatLongs[0])
                    || $plugin.onlyForPolygon.contains(linkLatLongs[1])
                ) {
                    $plugin.linkLeafletGuidsChecked[link.options.guid] = true;
                }
                else {
                    $plugin.linkLeafletGuidsChecked[link.options.guid] = $plugin.crossLinks.overridenFunctions.testPolyLine($plugin.onlyForPolygon, link, true);

                }
            }
            shouldCheckLink = $plugin.linkLeafletGuidsChecked[link.options.guid];
        }

        return shouldCheckLink;

    }

    //-------------------------------------------------------------
    // Crosslinks integration
    //-------------------------------------------------------------

    $plugin.crossLinks = {};

    $plugin.crossLinks.overridenFunctions = {};

    // Main override for drawn item against link
    $plugin.crossLinks.testPolyLine = function (drawItem, link, closed) {

        if (!$plugin.ShouldCheckDrawnItem(drawItem, closed)) {
            return false;
        }
        if (!$plugin.ShouldCheckLink(link)) {
            return false;
        }
        return $plugin.crossLinks.overridenFunctions.testPolyLine(drawItem, link, closed);
    }

    // We just reset the draw colors and polygons tables
    $plugin.crossLinks.checkAllLinks = function () {
        $plugin.drawcolors = [];
        $plugin.polygons = [];
        $plugin.crossLinks.overridenFunctions.checkAllLinks();
    }

    $plugin.crossLinks.init = function () {

        $plugin.crossLinks.overridenFunctions.testPolyLine = window.plugin.crossLinks.testPolyLine;
        window.plugin.crossLinks.testPolyLine = $plugin.crossLinks.testPolyLine;

        $plugin.crossLinks.overridenFunctions.checkAllLinks = window.plugin.crossLinks.checkAllLinks;
        window.plugin.crossLinks.checkAllLinks = $plugin.crossLinks.checkAllLinks;

        // Recolor Drawn Items fix: color changes do not trigger crosslink updates
        map.on('draw:recolored', function (e) {
            window.plugin.crossLinks.checkAllLinks();
        });

    }

    //-------------------------------------------------------------
    // UI
    //-------------------------------------------------------------

    $plugin.ui = {};

    $plugin.ui.init = function () {
        $('#toolbox').append('<a onclick="window.plugin.crossLinksEnhancements.ui.showOptions();return false;">Cross Links Enhancements</a>');
    }

    $plugin.ui.setOptions = function () {

        $plugin.selectedColors = [];

        $("#dialog-crossLinksEnhancementsOptions input[type=checkbox][name=crossLinkColors]").each(function (i, input) {
            if (input.checked) {
                $plugin.selectedColors.push(input.value);
            }

        })
    }

    $plugin.ui.showOptions = function () {
        var html = []
        html.push('<div class="crossLinksEnhancementsStyles">');

        html.push('<fieldset>');
        html.push('<legend>Draw items colors:</legend>');

        if ($plugin.drawcolors.length) {
            $plugin.drawcolors.forEach(function (color) {
                var domId = "crossLinkColors_" + color;
                var handler = "return window.plugin.crossLinksEnhancements.ui.clickColor('" + color + "');"
                html.push('<input ');
                html.push('type="checkbox" ');
                html.push('name="crossLinkColors" ');
                html.push('id="' + domId + '"');
                if ($plugin.selectedColors.indexOf(color) !== -1) {
                    html.push('checked ');
                }
                html.push('value="' + color + '">');
                html.push('<label for="' + domId + '"><span style="color: ' + color + ';">█</span></label>');
                html.push('&nbsp;&nbsp;&nbsp;&nbsp;');
            })
        }
        else {
            html.push('<em>Load a draw or wait first map update!</em>');
        }

        html.push('</fieldset>');

        html.push('</div>');

        dialog({
            html: html.join(''),
            title: 'Cross Links Options',
            id: 'crossLinksEnhancementsOptions',
            closeCallback: function () {window.plugin.crossLinksEnhancements.ui.setOptions(); }
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
