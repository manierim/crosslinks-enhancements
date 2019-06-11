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
    // Enhancements
    //-------------------------------------------------------------

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

        if (drawItem.options.color == '#c0c0c0') {
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
