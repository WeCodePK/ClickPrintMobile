//----------------------------------- IMPORTS -----------------------------------//

import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../constants/colors";

//----------------------------------- HTML TEMPLATE -----------------------------------//

const generateMapHtml = (colors) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
      background: ${colors.background};
    }
    .leaflet-tooltip.shop-map-label {
      background: ${colors.cardBackground};
      color: ${colors.textPrimary};
      border: 1.5px solid ${colors.printRequest};
      border-radius: 14px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      white-space: nowrap;
      cursor: pointer;
    }
    .leaflet-tooltip.shop-map-label::before { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var markers = {};
    var L;

    window.onload = function() {
      L = window.L;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    };

    function initMap(lat, lng, zoom) {
      if (map) return;
      map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], zoom);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd'
      }).addTo(map);

      map.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'deselect' }));
      });
    }

    function buildIcon(selected) {
      var size = selected ? 40 : 30;
      var fill = selected ? '${colors.primary}' : '${colors.printRequest}';
      var html = '<div style="width:' + size + 'px;height:' + size + 'px;transform:translateY(-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">' +
        '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 0C6.48 0 2 4.48 2 10c0 6.5 10 14 10 14s10-7.5 10-14C22 4.48 17.52 0 12 0z" fill="' + fill + '"/>' +
        '<circle cx="12" cy="10" r="4" fill="#ffffff"/>' +
        '</svg></div>';
      return L.divIcon({
        html: html,
        className: 'shop-map-pin',
        iconSize: [size, size],
        iconAnchor: [size / 2, size]
      });
    }

    function updateMarkers(shopsStr, selectedId) {
      if (!map || !L) return;

      // Clear old markers
      for (var id in markers) {
        markers[id].remove();
      }
      markers = {};

      var shops = JSON.parse(shopsStr);
      var points = [];

      shops.forEach(function(shop) {
        var selected = shop._id === selectedId;
        var marker = L.marker([shop.latLng.latitude, shop.latLng.longitude], {
          icon: buildIcon(selected)
        })
        .addTo(map)
        .bindTooltip(shop.name, {
          permanent: true,
          interactive: true,
          direction: 'top',
          offset: [0, selected ? -40 : -30],
          className: 'shop-map-label'
        })
        .openTooltip();

        function selectShop(e) {
          if (e) { e.stopPropagation(); e.preventDefault(); }
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', shopId: shop._id }));
        }

        // Click on the pin icon
        marker.on('click', function(e) {
          if (e.originalEvent) e.originalEvent.stopPropagation();
          selectShop(e.originalEvent);
        });

        // Click on the shop name label — attach a real DOM click listener
        // because Leaflet's layer event system does not relay tooltip clicks.
        var tooltipEl = marker.getTooltip() && marker.getTooltip().getElement();
        if (tooltipEl) {
          L.DomEvent.on(tooltipEl, 'click', function(domEvent) {
            L.DomEvent.stopPropagation(domEvent);
            selectShop(domEvent);
          });
        }

        markers[shop._id] = marker;
        points.push([shop.latLng.latitude, shop.latLng.longitude]);
      });

      // Extra bottom padding when a shop is selected so the callout card
      // doesn't hide any pins. The top padding is taller than the bottom-only
      // case because a pin's icon (anchored at its bottom point) and its
      // permanent label float well above the marker's lat/lng — without this,
      // a shop near the top edge gets its icon/label pushed off-screen.
      var boundsOpts = selectedId
        ? { paddingTopLeft: [30, 100], paddingBottomRight: [30, 220], maxZoom: 18 }
        : { paddingTopLeft: [30, 70], paddingBottomRight: [30, 30], maxZoom: 18 };

      if (shops.length === 1) {
        map.setView([shops[0].latLng.latitude, shops[0].latLng.longitude], selectedId ? 16 : 17);
      } else if (shops.length > 1) {
        map.fitBounds(points, boundsOpts);
      }
    }
  </script>
</body>
</html>
`;

//----------------------------------- COMPONENT -----------------------------------//

const ShopsMap = ({ shops, selectedShopId, initialRegion, onSelectShop, onDeselect }) => {
	const webViewRef = useRef(null);
	const [mapLoaded, setMapLoaded] = useState(false);

	const mapHtml = useRef(generateMapHtml(colors)).current;

	useEffect(() => {
		if (!mapLoaded || !webViewRef.current) return;

		const shopsJson = JSON.stringify(shops);
		const initLat = initialRegion ? initialRegion.latitude : 0;
		const initLng = initialRegion ? initialRegion.longitude : 0;

		const js = `
			initMap(${initLat}, ${initLng}, 13);
			updateMarkers(${JSON.stringify(shopsJson)}, ${JSON.stringify(selectedShopId)});
			true;
		`;
		webViewRef.current.injectJavaScript(js);
	}, [mapLoaded, shops, selectedShopId, initialRegion]);

	const onMessage = (event) => {
		try {
			const data = JSON.parse(event.nativeEvent.data);
			if (data.type === "ready") {
				setMapLoaded(true);
			} else if (data.type === "select") {
				onSelectShop(data.shopId);
			} else if (data.type === "deselect") {
				onDeselect();
			}
		} catch (e) {
			console.error("Failed to parse message from WebView:", e);
		}
	};

	return (
		<View style={styles.container}>
			<WebView
				ref={webViewRef}
				source={{ html: mapHtml }}
				style={styles.webView}
				originWhitelist={["*"]}
				javaScriptEnabled={true}
				domStorageEnabled={true}
				mixedContentMode="always"
				onMessage={onMessage}
			/>
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		...StyleSheet.absoluteFillObject,
		overflow: "hidden",
	},
	webView: {
		flex: 1,
		backgroundColor: colors.background,
	},
});

export default ShopsMap;
