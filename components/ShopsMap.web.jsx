//----------------------------------- IMPORTS -----------------------------------//

import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../constants/colors";
import { loadLeaflet } from "../utils/loadLeaflet";

//----------------------------------- HELPERS -----------------------------------//

// HTML pin rendered as a Leaflet divIcon so we don't depend on Leaflet's bundled
// marker images (which break when served from a CDN) and can brand the colors.
const buildIcon = (L, selected) => {
	const size = selected ? 40 : 30;
	const fill = selected ? colors.primary : colors.printRequest;
	const html = `
		<div style="width:${size}px;height:${size}px;transform:translateY(-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
			<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 0C6.48 0 2 4.48 2 10c0 6.5 10 14 10 14s10-7.5 10-14C22 4.48 17.52 0 12 0z" fill="${fill}"/>
				<circle cx="12" cy="10" r="4" fill="#ffffff"/>
			</svg>
		</div>`;
	return L.divIcon({
		html,
		className: "shop-map-pin",
		iconSize: [size, size],
		iconAnchor: [size / 2, size],
	});
};

// Brand the permanent name labels once (Leaflet's default tooltip is a plain box).
const ensureLabelStyles = () => {
	if (typeof document === "undefined" || document.getElementById("shop-map-label-styles")) return;
	const style = document.createElement("style");
	style.id = "shop-map-label-styles";
	style.textContent = `
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
		}
		.leaflet-tooltip.shop-map-label::before { display: none; }
	`;
	document.head.appendChild(style);
};

//----------------------------------- COMPONENT -----------------------------------//

// Web map backed by Leaflet + OpenStreetMap tiles (no API key). Mirrors the native
// component's contract: taps on a pin / empty map are lifted to the parent.
const ShopsMap = ({ shops, selectedShopId, initialRegion, onSelectShop, onDeselect }) => {
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const leafletRef = useRef(null);
	const markersRef = useRef({});
	// Map creation is async (Leaflet loads from CDN); flip this once it exists so the
	// marker effects — which only hold refs, not state — re-run and actually add pins.
	const [ready, setReady] = useState(false);

	// Keep the latest callbacks in refs so the map is only created once.
	const selectRef = useRef(onSelectShop);
	const deselectRef = useRef(onDeselect);
	selectRef.current = onSelectShop;
	deselectRef.current = onDeselect;

	// Create the map once.
	useEffect(() => {
		let cancelled = false;

		loadLeaflet()
			.then((L) => {
				if (cancelled || !containerRef.current || mapRef.current) return;
				leafletRef.current = L;
				ensureLabelStyles();

				const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(
					[initialRegion.latitude, initialRegion.longitude],
					13
				);
				// Minimal light basemap: streets only, no labels (CARTO Positron no-labels).
				L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
					maxZoom: 20,
					subdomains: "abcd",
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
				}).addTo(map);

				map.on("click", () => deselectRef.current?.());
				mapRef.current = map;
				if (!cancelled) setReady(true);

				// Container may have had zero size during init; force a re-measure.
				setTimeout(() => map.invalidateSize(), 0);
			})
			.catch((err) => console.error("Failed to initialise map:", err));

		return () => {
			cancelled = true;
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
			markersRef.current = {};
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Sync markers whenever the shop list changes.
	useEffect(() => {
		const L = leafletRef.current;
		const map = mapRef.current;
		if (!L || !map) return;

		Object.values(markersRef.current).forEach((m) => m.remove());
		markersRef.current = {};

		shops.forEach((shop) => {
			const selected = shop._id === selectedShopId;
			const marker = L.marker([shop.latLng.latitude, shop.latLng.longitude], {
				icon: buildIcon(L, selected),
			})
				.addTo(map)
				.bindTooltip(shop.name, {
					permanent: true,
					direction: "top",
					offset: [0, selected ? -40 : -30],
					className: "shop-map-label",
				})
				.openTooltip()
				.on("click", (e) => {
					e.originalEvent?.stopPropagation?.();
					selectRef.current?.(shop._id);
				});
			markersRef.current[shop._id] = marker;
		});

		if (shops.length === 1) {
			map.setView([shops[0].latLng.latitude, shops[0].latLng.longitude], 15);
		} else if (shops.length > 1) {
			const bounds = L.latLngBounds(shops.map((s) => [s.latLng.latitude, s.latLng.longitude]));
			map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
		}
		// selectedShopId handled in its own effect below to avoid refitting bounds on select.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shops, ready]);

	// Restyle markers when the selection changes.
	useEffect(() => {
		const L = leafletRef.current;
		if (!L) return;
		Object.entries(markersRef.current).forEach(([id, marker]) => {
			const selected = id === selectedShopId;
			marker.setIcon(buildIcon(L, selected));
			marker.setZIndexOffset(selected ? 1000 : 0);
			const tooltip = marker.getTooltip();
			if (tooltip) {
				tooltip.options.offset = L.point(0, selected ? -40 : -30);
				marker.setTooltipContent(tooltip.getContent());
			}
		});
	}, [selectedShopId]);

	return <View ref={containerRef} style={styles.map} />;
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	map: {
		...StyleSheet.absoluteFillObject,
	},
});

export default ShopsMap;
