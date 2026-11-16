import React from 'react';
import { View } from 'react-native';
import {
  RoadHorizon, Drop, Pipe, Lightbulb, Trash, Lightning, Bug, Barricade, DotsThree, CookingPot, HandHeart,
  Fingerprint, IdentificationCard, Certificate, Scroll, HouseLine, Shower, Buildings, Headset, MapPin,
} from 'phosphor-react-native';

// [Icon, soft tint, icon color, gradient for text posts]
const CAT = {
  'Roads & Potholes': [RoadHorizon, '#E8E4FF', '#6C5CE7', ['#5B3FD9', '#B197FC']],
  'Drinking Water': [Drop, '#DDF0FF', '#1C8CF5', ['#0B72C7', '#74C0FC']],
  'Drainage & Sewage': [Pipe, '#D9F4EA', '#12A37A', ['#0B8A63', '#63E6BE']],
  'Street Lights': [Lightbulb, '#FFF1C2', '#E8A300', ['#F08C00', '#FFD43B']],
  'Garbage & Sanitation': [Trash, '#DCF5E1', '#2FA84F', ['#2B8A3E', '#8CE99A']],
  Electricity: [Lightning, '#FFEBB8', '#F08C00', ['#E8590C', '#FFC078']],
  'Mosquito / Health': [Bug, '#FFDDE0', '#E5484D', ['#C92A2A', '#FF8787']],
  Encroachment: [Barricade, '#FFE3D4', '#E8590C', ['#D9480F', '#FFA94D']],
  Other: [DotsThree, '#E9EDEF', '#667781', ['#343A40', '#868E96']],
};
const SVC = {
  'Ration Card': [CookingPot, '#FFE3D4', '#E8590C'],
  'Pension (Aasara/YSR)': [HandHeart, '#FFDCEC', '#E0489A'],
  'Aadhaar Update': [Fingerprint, '#DDF0FF', '#1C8CF5'],
  'Voter ID': [IdentificationCard, '#E8E4FF', '#6C5CE7'],
  'Birth / Death Certificate': [Certificate, '#DCF5E1', '#2FA84F'],
  'Caste / Income Certificate': [Scroll, '#FFF1C2', '#E8A300'],
  'House Tax / Assessment': [HouseLine, '#D9F4EA', '#12A37A'],
  'Water Tap Connection': [Shower, '#DDF0FF', '#1C8CF5'],
  'Housing Scheme': [Buildings, '#E8E4FF', '#6C5CE7'],
  'Other Problem': [Headset, '#E9EDEF', '#667781'],
};
const FALLBACK = [MapPin, '#E9EDEF', '#667781', ['#343A40', '#868E96']];

const Tile = ({ map, name, size = 52, glyph }) => {
  const [Icon, bg, fg] = map[name] || FALLBACK;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={glyph || size * 0.52} color={fg} weight="duotone" />
    </View>
  );
};
export const CatTile = (p) => <Tile map={CAT} {...p} />;
export const SvcTile = (p) => <Tile map={SVC} {...p} />;
export const catGradient = (name) => (CAT[name] || FALLBACK)[3];
export const CatIconBare = ({ name, size = 16, color, weight = 'duotone' }) => {
  const [Icon, , fg] = CAT[name] || FALLBACK;
  return <Icon size={size} color={color || fg} weight={weight} />;
};
