//----------------------------------- IMPORTS -----------------------------------//

import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

// Minimal light basemap (CARTO Positron, no labels) to match the web map. Rendered as
// a raster tile overlay on top of a blank base (mapType="none") so the native Google
// map's own streets/labels don't show through.
const TILE_URL = "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png";

//----------------------------------- COMPONENT -----------------------------------//

// A single labelled pin. The name bubble is always visible; tapping selects the shop.
const ShopMarker = ({ shop, selected, onSelect }) => {
	// Custom (View-based) markers must re-render to the map texture on Android; keep
	// tracking on briefly around mount and selection changes, then switch it off to
	// avoid the constant-redraw flicker/perf hit.
	const [tracks, setTracks] = useState(true);
	useEffect(() => {
		setTracks(true);
		const t = setTimeout(() => setTracks(false), 400);
		return () => clearTimeout(t);
	}, [selected]);

	return (
		<Marker
			coordinate={shop.latLng}
			anchor={{ x: 0.5, y: 1 }}
			tracksViewChanges={tracks}
			onPress={(e) => {
				e.stopPropagation?.();
				onSelect(shop._id);
			}}
		>
			<View style={styles.markerWrap}>
				<View style={[styles.bubble, selected && styles.bubbleSelected]}>
					<Text style={[styles.bubbleText, selected && styles.bubbleTextSelected]} numberOfLines={1}>
						{shop.name}
					</Text>
				</View>
				<View style={[styles.pointer, selected && styles.pointerSelected]} />
			</View>
		</Marker>
	);
};

// Native (Android/iOS) map backed by react-native-maps. Marker taps and empty-map
// taps are lifted up so the parent can drive the shared shop-detail card.
const ShopsMap = ({ shops, selectedShopId, initialRegion, onSelectShop, onDeselect }) => {
	return (
		<MapView
			provider={PROVIDER_DEFAULT}
			mapType="none"
			zoomControlEnabled={false}
			style={StyleSheet.absoluteFill}
			initialRegion={initialRegion}
			onPress={onDeselect}
		>
			<UrlTile urlTemplate={TILE_URL} maximumZ={20} flipY={false} shouldReplaceMapContent />
			{shops.map((shop) => (
				<ShopMarker key={shop._id} shop={shop} selected={shop._id === selectedShopId} onSelect={onSelectShop} />
			))}
		</MapView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	markerWrap: {
		alignItems: "center",
	},
	bubble: {
		maxWidth: 160,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 14,
		backgroundColor: colors.cardBackground,
		borderWidth: 1.5,
		borderColor: colors.printRequest,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 4,
		elevation: 3,
	},
	bubbleSelected: {
		backgroundColor: colors.printRequest,
		borderColor: colors.printRequest,
	},
	bubbleText: {
		fontSize: 12,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	bubbleTextSelected: {
		color: colors.cardBackground,
	},
	pointer: {
		width: 0,
		height: 0,
		marginTop: -1,
		borderLeftWidth: 6,
		borderRightWidth: 6,
		borderTopWidth: 8,
		borderLeftColor: "transparent",
		borderRightColor: "transparent",
		borderTopColor: colors.printRequest,
	},
	pointerSelected: {
		borderTopColor: colors.printRequest,
	},
});

export default ShopsMap;
