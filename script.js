let map = L.map('map', {
    attributionControl: false,
    zoomControl: false,
    fadeAnimation: false,
    zoomAnimation: false
}).setView([46.603354, 1.888334], 6);

const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap | Données IGN/INSEE'
});
tileLayer.addTo(map);

let currentLayer = null;
let irisMarkers = []; // Pour stocker les marqueurs de numéros d'IRIS
let history = [];
let departementsData = null;
let communesData = null;
let irisGrandQuartierMap = {}; // Correspondance IRIS -> Grand Quartier
let currentLevel = 'departements';
const infoDiv = document.getElementById('info');
const loadingDiv = document.getElementById('loading');
const backButton = document.getElementById('backButton');
const resetButton = document.getElementById('resetButton');
const exportButton = document.getElementById('exportButton');
const zoomInButton = document.getElementById('zoomInButton');
const zoomOutButton = document.getElementById('zoomOutButton');
let currentCommuneData = null; // Pour stocker les données de la commune actuelle

// Palette de couleurs pour les grands quartiers
const grandQuartierColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#FFD93D', '#6BCB77', '#4D96FF',
    '#FF6F91', '#A8E6CF', '#FFD3B6', '#FFAAA5', '#FF8B94',
    '#C9B1FF', '#81C7DB', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#E74C3C', '#3498DB', '#2ECC71'
];

// Fonction pour générer le panneau de légende des grands quartiers avec design amélioré
function generateGrandQuartierLegend(grandQuartiersMap, irisFeatures, communeName) {
    let legendHTML = `
        <h2 class="text-2xl font-bold mb-4 text-gray-800">
            <span class="text-indigo-600">📍</span> ${communeName || 'N/A'}
        </h2>
    `;
    
    if (grandQuartiersMap.size === 0) {
        legendHTML += `
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p class="text-yellow-700">Aucun grand quartier défini pour cette commune</p>
                <p class="text-sm text-yellow-600 mt-1">${irisFeatures.length} IRIS au total</p>
            </div>
        `;
    } else {
        // En-tête avec statistiques
        legendHTML += `
            <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-6">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">Organisation territoriale</h3>
                        <p class="text-sm text-gray-600 mt-1">${grandQuartiersMap.size} grands quartiers • ${irisFeatures.length} IRIS</p>
                    </div>
                    <div class="text-3xl opacity-50">🗺️</div>
                </div>
            </div>
        `;
        
        // Créer un map pour organiser les IRIS par grand quartier
        const irisParGrandQuartier = new Map();
        grandQuartiersMap.forEach((info, gqCode) => {
            irisParGrandQuartier.set(gqCode, {
                ...info,
                irisList: []
            });
        });
        
        // Ajouter aussi une catégorie pour les IRIS isolés (sans grand quartier valide)
        const irisIsoles = [];
        
        // Répartir les IRIS
        irisFeatures.forEach(feature => {
            const gq = feature.properties.grand_quartier;
            const irisInfo = {
                code: feature.properties.code_iris || 'N/A',
                nom: feature.properties.nom_iris || 'N/A',
                type: feature.properties.type_iris || 'N/A'
            };
            
            if (gq && irisParGrandQuartier.has(gq)) {
                irisParGrandQuartier.get(gq).irisList.push(irisInfo);
            } else {
                irisIsoles.push(irisInfo);
            }
        });
        
        // Afficher chaque grand quartier avec sa légende colorée
        legendHTML += '<div class="space-y-3">';
        
        // Trier les grands quartiers par code
        const sortedGQ = Array.from(irisParGrandQuartier.entries()).sort((a, b) => {
            return parseInt(a[0]) - parseInt(b[0]);
        });
        
        sortedGQ.forEach(([gqCode, info], index) => {
            const uniqueId = `gq-${gqCode}-${Date.now()}`;
            legendHTML += `
                <div class="gq-container">
                    <div class="gq-header" onclick="toggleGrandQuartier('${uniqueId}')" id="header-${uniqueId}" 
                         onmouseenter="highlightGrandQuartier('${gqCode}')" onmouseleave="unhighlightAll()">
                        <div class="gq-color-indicator" style="background-color: ${info.color};"></div>
                        <div class="flex-grow">
                            <span class="font-semibold text-gray-800">Grand Quartier ${gqCode}</span>
                            <span class="ml-2 text-sm text-gray-500">(${info.irisList.length} IRIS)</span>
                        </div>
                        <span class="text-gray-400" id="arrow-${uniqueId}">▼</span>
                    </div>
                    <div class="gq-content hidden" id="content-${uniqueId}">
                        ${info.irisList.map(iris => `
                            <div class="iris-item" onmouseenter="highlightIris('${iris.code}')" onmouseleave="unhighlightAll()">
                                <div class="flex flex-col">
                                    <div class="flex justify-between items-start">
                                        <span class="font-medium pr-2 flex-grow">${iris.nom}</span>
                                        <span class="text-xs text-gray-500 flex-shrink-0">${iris.code}</span>
                                    </div>
                                    ${iris.type !== 'N/A' ? `<div class="text-xs text-gray-400 mt-1">Type: ${iris.type}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        // Afficher les IRIS isolés si il y en a
        if (irisIsoles.length > 0) {
            const uniqueId = `gq-isoles-${Date.now()}`;
            legendHTML += `
                <div class="gq-container border-gray-300">
                    <div class="gq-header" onclick="toggleGrandQuartier('${uniqueId}')" id="header-${uniqueId}">
                        <div class="gq-color-indicator" style="background-color: #9CA3AF; border-color: #6B7280;"></div>
                        <div class="flex-grow">
                            <span class="font-semibold text-gray-700">IRIS Isolés</span>
                            <span class="ml-2 text-sm text-gray-500">(${irisIsoles.length} IRIS)</span>
                        </div>
                        <span class="text-gray-400" id="arrow-${uniqueId}">▼</span>
                    </div>
                    <div class="gq-content hidden" id="content-${uniqueId}">
                        <div class="text-xs text-gray-600 mb-2 italic">
                            IRIS n'appartenant pas à un grand quartier (moins de 2 IRIS dans le secteur)
                        </div>
                        ${irisIsoles.map(iris => `
                            <div class="iris-item border-l-gray-400" onmouseenter="highlightIris('${iris.code}')" onmouseleave="unhighlightAll()">
                                <div class="flex flex-col">
                                    <div class="flex justify-between items-start">
                                        <span class="font-medium text-gray-600 pr-2 flex-grow">${iris.nom}</span>
                                        <span class="text-xs text-gray-500 flex-shrink-0">${iris.code}</span>
                                    </div>
                                    ${iris.type !== 'N/A' ? `<div class="text-xs text-gray-400 mt-1">Type: ${iris.type}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        legendHTML += '</div>';
        
        // Résumé avec style amélioré
        legendHTML += `
            <div class="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 class="text-sm font-semibold text-gray-700 mb-2">📊 Résumé</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Total IRIS:</span>
                        <span class="font-medium">${irisFeatures.length}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Grands quartiers:</span>
                        <span class="font-medium">${grandQuartiersMap.size}</span>
                    </div>
                    ${irisIsoles.length > 0 ? `
                    <div class="flex justify-between col-span-2">
                        <span class="text-gray-600">IRIS isolés:</span>
                        <span class="font-medium text-gray-600">${irisIsoles.length}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    }
    
    return legendHTML;
}

// Fonction pour toggle l'affichage des IRIS dans un grand quartier
function toggleGrandQuartier(uniqueId) {
    const content = document.getElementById(`content-${uniqueId}`);
    const header = document.getElementById(`header-${uniqueId}`);
    const arrow = document.getElementById(`arrow-${uniqueId}`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        header.classList.add('expanded');
        arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        header.classList.remove('expanded');
        arrow.textContent = '▼';
    }
}

// Fonction pour mettre en surbrillance un grand quartier sur la carte
function highlightGrandQuartier(gqCode) {
    if (!currentLayer || currentLevel !== 'iris') return;
    
    currentLayer.eachLayer(layer => {
        const feature = layer.feature;
        if (feature.properties.grand_quartier === gqCode) {
            // Mettre en surbrillance les IRIS du grand quartier avec leur couleur originale
            const originalColor = currentCommuneData.grandQuartiersMap.get(gqCode).color;
            layer.setStyle({
                fillOpacity: 0.9,
                weight: 4,
                color: originalColor
            });
        } else {
            // Atténuer les autres IRIS
            const gq = feature.properties.grand_quartier;
            if (gq && currentCommuneData?.grandQuartiersMap.has(gq)) {
                layer.setStyle({
                    color: currentCommuneData.grandQuartiersMap.get(gq).color,
                    weight: 1,
                    fillOpacity: 0.2
                });
            } else {
                layer.setStyle({
                    color: '#9CA3AF',
                    fillColor: '#E5E7EB',
                    weight: 1,
                    fillOpacity: 0.2
                });
            }
        }
    });
}

// Fonction pour mettre en surbrillance un IRIS spécifique sur la carte
function highlightIris(irisCode) {
    if (!currentLayer || currentLevel !== 'iris') return;
    
    currentLayer.eachLayer(layer => {
        const feature = layer.feature;
        if (feature.properties.code_iris === irisCode) {
            // Mettre en surbrillance l'IRIS spécifique avec sa couleur originale
            const gq = feature.properties.grand_quartier;
            let originalColor;
            if (gq && currentCommuneData?.grandQuartiersMap.has(gq)) {
                originalColor = currentCommuneData.grandQuartiersMap.get(gq).color;
            } else {
                originalColor = '#9CA3AF'; // Couleur des IRIS isolés
            }
            layer.setStyle({
                fillOpacity: 0.9,
                weight: 4,
                color: originalColor
            });
        } else {
            // Atténuer les autres IRIS
            const gq = feature.properties.grand_quartier;
            if (gq && currentCommuneData?.grandQuartiersMap.has(gq)) {
                layer.setStyle({
                    color: currentCommuneData.grandQuartiersMap.get(gq).color,
                    weight: 1,
                    fillOpacity: 0.2
                });
            } else {
                layer.setStyle({
                    color: '#9CA3AF',
                    fillColor: '#E5E7EB',
                    weight: 1,
                    fillOpacity: 0.2
                });
            }
        }
    });
}

// Fonction pour remettre tous les IRIS dans leur état normal
function unhighlightAll() {
    if (!currentLayer || currentLevel !== 'iris') return;
    
    currentLayer.eachLayer(layer => {
        const feature = layer.feature;
        const gq = feature.properties.grand_quartier;
        if (gq && currentCommuneData?.grandQuartiersMap.has(gq)) {
            layer.setStyle({
                color: currentCommuneData.grandQuartiersMap.get(gq).color,
                weight: 2,
                fillOpacity: 0.5
            });
        } else {
            layer.setStyle({
                color: '#9CA3AF',
                fillColor: '#E5E7EB',
                weight: 1,
                fillOpacity: 0.6
            });
        }
    });
}

// Fonction pour calculer la position optimale des labels d'IRIS
function calculateOptimalLabelPosition(feature) {
    if (!feature.geometry) return null;
    
    try {
        // Créer un objet Leaflet de la géométrie pour utiliser ses méthodes
        const leafletGeometry = L.geoJSON(feature);
        const bounds = leafletGeometry.getBounds();
        
        // Méthode 1: Tenter le centroïde géométrique
        let centroid = null;
        if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates && feature.geometry.coordinates[0]) {
            centroid = calculatePolygonCentroid(feature.geometry.coordinates[0]);
        } else if (feature.geometry.type === 'MultiPolygon' && feature.geometry.coordinates) {
            // Pour MultiPolygon, prendre le centroïde du plus grand polygone
            let largestPolygon = null;
            let largestArea = 0;
            
            feature.geometry.coordinates.forEach(polygon => {
                if (polygon[0]) {
                    const area = calculatePolygonArea(polygon[0]);
                    if (area > largestArea) {
                        largestArea = area;
                        largestPolygon = polygon[0];
                    }
                }
            });
            
            if (largestPolygon) {
                centroid = calculatePolygonCentroid(largestPolygon);
            }
        }
        
        // Vérifier si le centroïde est dans la géométrie
        if (centroid && isPointInGeometry(centroid, feature)) {
            return L.latLng(centroid[1], centroid[0]);
        }
        
        // Méthode 2: Fallback - utiliser le centre des bounds
        const boundsCenter = bounds.getCenter();
        if (isPointInGeometry([boundsCenter.lng, boundsCenter.lat], feature)) {
            return boundsCenter;
        }
        
        // Méthode 3: Fallback ultime - chercher un point à l'intérieur par échantillonnage
        return findPointInside(bounds, feature);
        
    } catch (error) {
        console.warn('Erreur calcul position label pour IRIS:', feature.properties?.code_iris, error);
        // Fallback simple en cas d'erreur
        return L.geoJSON(feature).getBounds().getCenter();
    }
}

// Calcule le centroïde d'un polygone (coordonnées en [lon, lat])
function calculatePolygonCentroid(coordinates) {
    let area = 0;
    let x = 0;
    let y = 0;
    
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
        const xi = coordinates[i][0];
        const yi = coordinates[i][1];
        const xj = coordinates[j][0];
        const yj = coordinates[j][1];
        
        const a = xi * yj - xj * yi;
        area += a;
        x += (xi + xj) * a;
        y += (yi + yj) * a;
    }
    
    area *= 0.5;
    if (area === 0) {
        // Fallback: moyenne des coordonnées
        const avgX = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
        const avgY = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
        return [avgX, avgY];
    }
    
    return [x / (6 * area), y / (6 * area)];
}

// Calcule l'aire approximative d'un polygone
function calculatePolygonArea(coordinates) {
    let area = 0;
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
        area += (coordinates[j][0] + coordinates[i][0]) * (coordinates[j][1] - coordinates[i][1]);
    }
    return Math.abs(area / 2);
}

// Vérifie si un point est à l'intérieur d'une géométrie
function isPointInGeometry(point, feature) {
    try {
        const leafletPoint = L.latLng(point[1], point[0]);
        const leafletGeometry = L.geoJSON(feature);
        
        // Utiliser Leaflet pour tester si le point est dans la géométrie
        let isInside = false;
        leafletGeometry.eachLayer(layer => {
            if (layer.getBounds().contains(leafletPoint)) {
                // Test plus précis avec ray casting si possible
                if (layer.feature.geometry.type === 'Polygon' || layer.feature.geometry.type === 'MultiPolygon') {
                    isInside = isPointInPolygon(point, layer.feature.geometry);
                } else {
                    isInside = true; // Pour autres géométries, accepter si dans les bounds
                }
            }
        });
        
        return isInside;
    } catch (error) {
        return false;
    }
}

// Algorithme ray casting pour tester si un point est dans un polygone
function isPointInPolygon(point, geometry) {
    const [x, y] = point;
    
    function testPolygon(coordinates) {
        let inside = false;
        for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
            const [xi, yi] = coordinates[i];
            const [xj, yj] = coordinates[j];
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }
    
    if (geometry.type === 'Polygon') {
        return testPolygon(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some(polygon => testPolygon(polygon[0]));
    }
    
    return false;
}

// Trouve un point à l'intérieur de la géométrie par échantillonnage
function findPointInside(bounds, feature) {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    
    // Échantillonnage en grille 5x5
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const lat = sw.lat + (ne.lat - sw.lat) * (i + 0.5) / 5;
            const lng = sw.lng + (ne.lng - sw.lng) * (j + 0.5) / 5;
            const testPoint = [lng, lat];
            
            if (isPointInGeometry(testPoint, feature)) {
                return L.latLng(lat, lng);
            }
        }
    }
    
    // Si aucun point trouvé, retourner le centre des bounds (mieux que rien)
    return bounds.getCenter();
}

infoDiv.innerText = 'Niveau actuel : Chargement...';
loadingDiv.style.display = 'block';

// Fonction pour charger et parser le CSV
function loadCSV(url) {
    return fetch(url)
        .then(response => response.text())
        .then(text => {
            const lines = text.split('\n');
            const result = {};
            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const [iris, grdQuart] = line.split(';');
                    if (iris && grdQuart) {
                        result[iris] = grdQuart;
                    }
                }
            }
            return result;
        });
}

// Charge les fichiers GeoJSON et CSV
Promise.all([
    fetch('data/departements.geojson').then(res => res.json()),
    fetch('data/communes.geojson').then(res => res.json()),
    loadCSV('data/iris_grd_quartier.csv')
])
    .then(([depts, communes, irisGQ]) => {
        departementsData = depts;
        communesData = communes;
        irisGrandQuartierMap = irisGQ;
        console.log('Départements chargés :', departementsData.features.length);
        console.log('Communes chargées :', communesData.features.length);
        console.log('Correspondances IRIS-GQ chargées :', Object.keys(irisGrandQuartierMap).length);
        console.log('Exemple de properties départements :', departementsData.features[0].properties);
        console.log('Exemple de properties communes :', communesData.features[0].properties);
        showLevel(currentLevel);
        loadingDiv.style.display = 'none';
    })
    .catch(err => {
        console.error('Erreur chargement des données GeoJSON :', err);
        infoDiv.innerText = `Erreur de chargement : ${err.message}. Vérifiez la console.`;
        loadingDiv.style.display = 'none';
    });

function showLevel(level, filterCode = null) {
    if (currentLayer) map.removeLayer(currentLayer);
    
    // Retirer les marqueurs d'IRIS existants
    irisMarkers.forEach(marker => map.removeLayer(marker));
    irisMarkers = [];

    let features = [];
    let style = {};
    if (level === 'departements') {
        features = departementsData.features;
        style = { color: '#1e90ff', weight: 2, fillOpacity: 0.4 };
    } else if (level === 'communes') {
        features = communesData.features.filter(f => f.properties.code.slice(0, 2) === filterCode);
        style = { color: '#2ecc71', weight: 2, fillOpacity: 0.4 };
    }

    if (features.length === 0 && level !== 'iris') {
        alert('Aucune feature trouvée pour ce niveau. Vérifiez les properties.');
        console.log('Properties disponibles départements :', departementsData.features.map(f => f.properties));
        console.log('Properties disponibles communes :', communesData.features.map(f => f.properties));
        return;
    }

    console.log(`Features pour ${level} :`, features.map(f => f.properties.nom));

    currentLayer = L.geoJSON(features, {
        style: style,
        onEachFeature: (feature, layer) => {
            layer.bindPopup(getPopupContent(feature, level), {
                className: 'custom-popup'
            });
            layer.bindTooltip(getTooltipContent(feature, level), {
                direction: 'top',
                offset: [0, -10],
                className: 'custom-tooltip'
            });
            layer.on('click', () => {
                drillDown(feature, level);
                updateInfoPanel(feature, level);
            });
            layer.on('mouseover', () => {
                layer.setStyle({
                    fillOpacity: 0.7,
                    weight: 3,
                    color: style.color
                });
            });
            layer.on('mouseout', () => {
                layer.setStyle(style);
            });
        }
    }).addTo(map);

    if (features.length > 0) {
        map.fitBounds(currentLayer.getBounds());
    }
    currentLevel = level;
    infoDiv.innerText = `Niveau actuel : ${level.charAt(0).toUpperCase() + level.slice(1)} (${features.length} éléments)`;
    history.push({ level, filterCode, bounds: map.getBounds() });
    updateBackButton();
}

function getPopupContent(feature, level) {
    const props = feature.properties || {};
    let content = `<div class="p-3"><h3 class="font-bold text-lg">${level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()}</h3>`;
    if (level === 'departements') {
        content += `<p><strong>Nom:</strong> ${props.nom || 'Inconnue'}</p><p><strong>Code:</strong> ${props.code || 'N/A'}</p>`;
    } else if (level === 'communes') {
        content += `<p><strong>Nom:</strong> ${props.nom || 'Inconnue'}</p><p><strong>Code:</strong> ${props.code || 'N/A'}</p>`;
    } else if (level === 'iris') {
        content += `<p><strong>IRIS:</strong> ${props.nom_iris || 'Inconnue'}</p><p><strong>Code:</strong> ${props.code_iris || 'N/A'}</p>`;
        if (props.grand_quartier) {
            content += `<p><strong>Grand Quartier:</strong> ${props.grand_quartier}</p>`;
        }
        content += `<p><strong>Type:</strong> ${props.type_iris || 'N/A'}</p><p><strong>Commune:</strong> ${props.nom_commune || 'N/A'}</p>`;
    }
    content += '</div>';
    return content;
}

// Fonction pour compter les grands quartiers d'une commune
async function getGrandQuartiersCount(communeCode) {
    const depCode = communeCode.slice(0, 2);
    try {
        const response = await fetch(`data/iris_par_departement/iris_${depCode}.geojson`);
        const irisData = await response.json();
        const irisFeatures = irisData.features.filter(f => f.properties.code_insee === communeCode);
        
        const grandQuartiersSet = new Set();
        irisFeatures.forEach(feature => {
            const irisCode = feature.properties.code_iris;
            const grandQuartier = irisGrandQuartierMap[irisCode];
            if (grandQuartier) {
                grandQuartiersSet.add(grandQuartier);
            }
        });
        
        return { totalIris: irisFeatures.length, totalGQ: grandQuartiersSet.size };
    } catch (error) {
        return { totalIris: 0, totalGQ: 0 };
    }
}

function getTooltipContent(feature, level) {
    const props = feature.properties || {};
    if (level === 'departements') return `${props.nom || 'Inconnue'} (${props.code || 'N/A'})`;
    if (level === 'communes') {
        // Créer un tooltip enrichi pour les communes
        const communeName = props.nom || 'Inconnue';
        const communeCode = props.code || 'N/A';
        
        // Récupérer le nombre de grands quartiers de manière asynchrone
        getGrandQuartiersCount(communeCode).then(({ totalIris, totalGQ }) => {
            if (totalGQ > 0 && feature._tooltip) {
                const enrichedTooltip = `
                    <div class="tooltip-title">${communeName}</div>
                    <div class="tooltip-info">
                        <div>Code INSEE: ${communeCode}</div>
                        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.2);">
                            <div>🏘️ ${totalGQ} grand${totalGQ > 1 ? 's' : ''} quartier${totalGQ > 1 ? 's' : ''}</div>
                            <div>📋 ${totalIris} IRIS</div>
                        </div>
                    </div>
                `;
                feature._tooltip.setContent(enrichedTooltip);
                feature._tooltip._container.classList.add('commune-enhanced');
            }
        });
        
        // Retourner un contenu initial simple
        return `${communeName} (${communeCode})`;
    }
    if (level === 'iris') {
        const baseTooltip = `${props.nom_iris || 'Inconnue'} (${props.code_iris || 'N/A'})`;
        if (props.grand_quartier) {
            return `${baseTooltip} - GQ: ${props.grand_quartier}`;
        }
        return baseTooltip;
    }
    return 'Inconnu';
}

function updateInfoPanel(feature, level) {
    const props = feature.properties || {};
    
    // Pour les niveaux département et commune, affichage normal
    if (level === 'departements' || level === 'communes') {
        let content = `<h3 class="text-xl font-semibold mb-3 text-gray-800">${level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()}</h3>`;
        if (level === 'departements') {
            content += `<p><strong>Nom:</strong> ${props.nom || 'Inconnue'}</p><p><strong>Code:</strong> ${props.code || 'N/A'}</p>`;
        } else {
            content += `<p><strong>Nom:</strong> ${props.nom || 'Inconnue'}</p><p><strong>Code:</strong> ${props.code || 'N/A'}</p>`;
        }
        infoDiv.innerHTML = content;
    }
}

function drillDown(feature, level) {
    if (level === 'departements') {
        const depCode = feature.properties.code;
        showLevel('communes', depCode);
    } else if (level === 'communes') {
        const communeCode = feature.properties.code;
        const depCode = communeCode.slice(0, 2);
        
        fetch(`data/iris_par_departement/iris_${depCode}.geojson`)
            .then(res => res.json())
            .then(irisData => {
                const irisFeatures = irisData.features.filter(f => f.properties.code_insee === communeCode);
                if (irisFeatures.length === 0) {
                    alert('Aucune donnée IRIS pour cette commune.');
                    return;
                }
                
                // Créer la map des grands quartiers avec couleurs
                // D'abord, compter les IRIS par grand quartier
                const irisCountByGQ = new Map();
                irisFeatures.forEach(f => {
                    const gq = irisGrandQuartierMap[f.properties.code_iris];
                    if (gq) {
                        irisCountByGQ.set(gq, (irisCountByGQ.get(gq) || 0) + 1);
                    }
                });
                
                // Créer la map des grands quartiers avec couleurs (seulement pour ceux avec au moins 2 IRIS)
                const grandQuartiersMap = new Map();
                let colorIndex = 0;
                irisFeatures.forEach(f => {
                    const gq = irisGrandQuartierMap[f.properties.code_iris];
                    if (gq && irisCountByGQ.get(gq) >= 2 && !grandQuartiersMap.has(gq)) {
                        grandQuartiersMap.set(gq, {
                            color: grandQuartierColors[colorIndex % grandQuartierColors.length],
                            count: irisCountByGQ.get(gq)
                        });
                        colorIndex++;
                    }
                    // Assigner le grand quartier seulement s'il a au moins 2 IRIS
                    f.properties.grand_quartier = (gq && irisCountByGQ.get(gq) >= 2) ? gq : null;
                });
                
                // Mettre à jour currentCommuneData
                currentCommuneData = {
                    name: feature.properties.nom,
                    code: communeCode,
                    irisFeatures: irisFeatures,
                    grandQuartiersMap: grandQuartiersMap
                };
                
                if (currentLayer) map.removeLayer(currentLayer);
                irisMarkers.forEach(marker => map.removeLayer(marker));
                irisMarkers = [];
                
                currentLayer = L.geoJSON(irisFeatures, {
                    style: feature => {
                        const gq = feature.properties.grand_quartier;
                        if (gq && grandQuartiersMap.has(gq)) {
                            // IRIS dans un grand quartier valide (≥2 IRIS)
                            return {
                                color: grandQuartiersMap.get(gq).color,
                                weight: 2,
                                fillOpacity: 0.5
                            };
                        } else {
                            // IRIS isolé (pas de GQ ou GQ avec <2 IRIS) - affiché en gris
                            return {
                                color: '#9CA3AF',
                                fillColor: '#E5E7EB',
                                weight: 1,
                                fillOpacity: 0.6
                            };
                        }
                    },
                    onEachFeature: (feature, layer) => {
                        layer.bindPopup(getPopupContent(feature, 'iris'), {
                            className: 'custom-popup'
                        });
                        layer.bindTooltip(getTooltipContent(feature, 'iris'), {
                            direction: 'top',
                            offset: [0, -10],
                            className: 'custom-tooltip'
                        });
                        layer.on('mouseover', () => {
                            layer.setStyle({
                                fillOpacity: 0.8,
                                weight: 3
                            });
                        });
                        layer.on('mouseout', () => {
                            const gq = feature.properties.grand_quartier;
                            if (gq && grandQuartiersMap.has(gq)) {
                                layer.setStyle({
                                    color: grandQuartiersMap.get(gq).color,
                                    weight: 2,
                                    fillOpacity: 0.5
                                });
                            } else {
                                layer.setStyle({
                                    color: '#9CA3AF',
                                    fillColor: '#E5E7EB',
                                    weight: 1,
                                    fillOpacity: 0.6
                                });
                            }
                        });
                    }
                }).addTo(map);
                
                // Ajouter les labels pour les numéros d'IRIS
                irisFeatures.forEach(feature => {
                    if (feature.geometry) {
                        const coords = calculateOptimalLabelPosition(feature);
                        if (coords) {
                            const marker = L.marker(coords, {
                                icon: L.divIcon({
                                    className: 'iris-label',
                                    html: `<div class="text-sm font-bold text-black bg-white rounded px-1 py-0.5 shadow">${feature.properties.code_iris ? feature.properties.code_iris.slice(-4) : 'N/A'}</div>`
                                })
                            }).addTo(map);
                            irisMarkers.push(marker);
                        }
                    }
                });
                
                map.fitBounds(currentLayer.getBounds(), { padding: [20, 20] });
                currentLevel = 'iris';
                infoDiv.innerHTML = generateGrandQuartierLegend(grandQuartiersMap, irisFeatures, feature.properties.nom);
                history.push({ level: 'iris', filterCode: communeCode, bounds: map.getBounds() });
                updateBackButton();
                exportButton.classList.remove('hidden');
            })
            .catch(err => {
                console.error('Erreur chargement IRIS :', err);
                alert('Erreur lors du chargement des données IRIS.');
            });
    }
}

function goBack() {
    if (history.length > 1) {
        history.pop();
        const prev = history[history.length - 1];
        if (currentLayer) map.removeLayer(currentLayer);
        irisMarkers.forEach(marker => map.removeLayer(marker));
        irisMarkers = [];
        
        showLevel(prev.level, prev.filterCode);
        map.fitBounds(prev.bounds);
        
        // Cacher le bouton d'export si on quitte le niveau IRIS
        if (prev.level !== 'iris') {
            exportButton.classList.add('hidden');
            currentCommuneData = null;
        }
    } else {
        alert('Pas de niveau précédent.');
        history = [];
        irisMarkers.forEach(marker => map.removeLayer(marker));
        irisMarkers = [];
        showLevel('departements');
        exportButton.classList.add('hidden');
        currentCommuneData = null;
    }
}

function resetMap() {
    history = [];
    // Retirer les marqueurs d'IRIS
    irisMarkers.forEach(marker => map.removeLayer(marker));
    irisMarkers = [];
    showLevel('departements');
    exportButton.classList.add('hidden');
    currentCommuneData = null;
}

function updateBackButton() {
    backButton.disabled = history.length <= 1;
}

// Fonction d'export corrigée avec dom-to-image
async function exportMap() {
    if (!currentCommuneData) {
        alert('Aucune donnée de commune à exporter');
        return;
    }

    // Message de chargement
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]';
    loadingMessage.innerHTML = `
        <div class="bg-white rounded-lg p-6 shadow-xl">
            <div class="text-lg font-semibold mb-2">🗺️ Génération du PDF en cours...</div>
            <div class="text-sm text-gray-600">Préparation de la carte et de la légende</div>
            <div class="text-xs text-gray-500 mt-2">La carte sera exportée avec la vue actuelle</div>
            <div class="mt-4 flex justify-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        </div>
    `;
    document.body.appendChild(loadingMessage);

    try {
        // Sauvegarder la vue ACTUELLE (sans la changer !)
        const originalCenter = map.getCenter();
        const originalZoom = map.getZoom();
        console.log('Export - Vue sauvegardée:', originalCenter, originalZoom);

        // Forcer refresh des tuiles et taille (sans changer la vue)
        map.invalidateSize(true);

        // Attendre que les tuiles soient chargées (essentiel pour éviter les manques/décalages)
        await new Promise((resolve) => {
            if (tileLayer._loaded) {
                resolve(); // Déjà chargé
            } else {
                tileLayer.once('load', resolve);
                // Fallback si pas d'événement
                setTimeout(resolve, 2000);
            }
        });

        // Attendre stabilisation de la carte (moveend)
        await new Promise((resolve) => {
            const onMoveEnd = () => {
                map.off('moveend', onMoveEnd);
                setTimeout(resolve, 500); // Délai pour tuiles finales
            };
            map.on('moveend', onMoveEnd);
            setTimeout(() => {
                map.off('moveend', onMoveEnd);
                resolve();
            }, 3000);
        });

        console.log('Export - Vue avant capture:', map.getCenter(), map.getZoom());

        // Masquer contrôles (et réactiver temporairement les animations si besoin, mais on les garde désactivées)
        const buttons = document.querySelector('.absolute.top-4.left-4');
        const zoomControl = document.querySelector('.leaflet-control-zoom');
        const attributionControl = document.querySelector('.leaflet-control-attribution');
        const originalButtonsDisplay = buttons ? buttons.style.display : '';
        const originalZoomDisplay = zoomControl ? zoomControl.style.display : '';
        const originalAttributionDisplay = attributionControl ? attributionControl.style.display : '';
        if (buttons) buttons.style.display = 'none';
        if (zoomControl) zoomControl.style.display = 'none';
        if (attributionControl) attributionControl.style.display = 'none';

        // Obtenir dimensions exactes de la carte
        const mapElement = document.getElementById('map');
        const width = mapElement.offsetWidth;
        const height = mapElement.offsetHeight;

        // Capture avec dom-to-image (remplace html2canvas - gère mieux les transforms/offsets)
        const mapDataUrl = await domtoimage.toPng(mapElement, {
            width: width,
            height: height,
            bgcolor: '#f8f9fa', // Fond clair si zones vides
            imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==' // Placeholder pour images manquantes
        });

        // Restaurer contrôles et vue
        if (buttons) buttons.style.display = originalButtonsDisplay;
        if (zoomControl) zoomControl.style.display = originalZoomDisplay;
        if (attributionControl) attributionControl.style.display = originalAttributionDisplay;
        map.setView(originalCenter, originalZoom, { animate: false });

        // Initialiser jsPDF et ajouter titre/date
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        pdf.setFontSize(22);
        pdf.setTextColor(0, 51, 102);
        const title = `Carte de la commune : ${currentCommuneData.name}`;
        const titleWidth = pdf.getTextWidth(title);
        const pageWidth = 297;
        const titleX = (pageWidth - titleWidth) / 2;
        pdf.text(title, titleX, 20);
        pdf.setFontSize(11);
        pdf.setTextColor(100, 100, 100);
        const dateText = `Généré le ${new Date().toLocaleDateString('fr-FR')} • ${currentCommuneData.grandQuartiersMap.size} grands quartiers • ${currentCommuneData.irisFeatures.length} IRIS`;
        const dateWidth = pdf.getTextWidth(dateText);
        const dateX = (pageWidth - dateWidth) / 2;
        pdf.text(dateText, dateX, 28);

        // Ajouter image au PDF (ajusté pour les dims de dom-to-image)
        pdf.addImage(mapDataUrl, 'PNG', 10, 35, 277, 165);

        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text('Voir page suivante pour la légende détaillée →', 250, 205);

        // Page 2 : Légende (inchangé)
        pdf.addPage('a4', 'landscape');
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(18);
        pdf.text('Légende des Grands Quartiers', 15, 20);
        pdf.setFontSize(12);
        pdf.text(`Commune : ${currentCommuneData.name}`, 15, 28);
        
        let yPosition = 40;
        let xPosition = 15;
        let columnCount = 0;
        const columnWidth = 90;
        const maxColumnHeight = 160;
        
        const sortedGQ = Array.from(currentCommuneData.grandQuartiersMap.entries()).sort((a, b) => {
            return parseInt(a[0]) - parseInt(b[0]);
        });
        
        sortedGQ.forEach(([gqCode, info], index) => {
            const irisInGQ = currentCommuneData.irisFeatures.filter(f => f.properties.grand_quartier === gqCode);
            const blockHeight = 10 + (irisInGQ.length * 4);
            
            if (yPosition + blockHeight > maxColumnHeight) {
                columnCount++;
                if (columnCount >= 3) {
                    pdf.addPage();
                    yPosition = 20;
                    xPosition = 15;
                    columnCount = 0;
                    pdf.setFontSize(14);
                    pdf.text('Légende des Grands Quartiers (suite)', 15, 15);
                    yPosition = 30;
                } else {
                    xPosition += columnWidth;
                    yPosition = 40;
                }
            }
            
            const rgb = hexToRgb(info.color);
            pdf.setFillColor(rgb.r, rgb.g, rgb.b);
            pdf.rect(xPosition, yPosition - 3, 5, 5, 'F');
            
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(11);
            pdf.setFont(undefined, 'bold');
            pdf.text(`GQ ${gqCode}`, xPosition + 8, yPosition);
            pdf.setFont(undefined, 'normal');
            yPosition += 6;
            
            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            irisInGQ.forEach(iris => {
                const irisNum = iris.properties.code_iris ? iris.properties.code_iris.slice(-4) : 'N/A';
                const irisName = iris.properties.nom_iris || '';
                const displayText = `  • ${irisNum} - ${irisName}`;
                
                // Gérer les noms longs en les coupant sur plusieurs lignes si nécessaire
                const maxWidth = columnWidth - 15;
                const textWidth = pdf.getTextWidth(displayText);
                
                if (textWidth > maxWidth && irisName.length > 20) {
                    // Couper le nom en deux parties
                    const firstPart = `  • ${irisNum} - ${irisName.substring(0, 15)}`;
                    const secondPart = `    ${irisName.substring(15)}`;
                    pdf.text(firstPart, xPosition + 8, yPosition);
                    yPosition += 4;
                    pdf.text(secondPart, xPosition + 8, yPosition);
                    yPosition += 4;
                } else {
                    pdf.text(displayText, xPosition + 8, yPosition);
                    yPosition += 4;
                }
            });
            yPosition += 4;
        });
        
        const irisIsoles = currentCommuneData.irisFeatures.filter(f => !f.properties.grand_quartier);
        if (irisIsoles.length > 0) {
            const blockHeight = 10 + (irisIsoles.length * 4);
            
            if (yPosition + blockHeight > maxColumnHeight) {
                columnCount++;
                if (columnCount >= 3) {
                    pdf.addPage();
                    yPosition = 20;
                    xPosition = 15;
                    columnCount = 0;
                    pdf.setFontSize(14);
                    pdf.text('Légende des Grands Quartiers (suite)', 15, 15);
                    yPosition = 30;
                } else {
                    xPosition += columnWidth;
                    yPosition = 40;
                }
            }
            
            pdf.setFillColor(156, 163, 175); // Couleur grise pour les IRIS isolés
            pdf.rect(xPosition, yPosition - 3, 5, 5, 'F');
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(11);
            pdf.setFont(undefined, 'bold');
            pdf.text(`IRIS Isolés`, xPosition + 8, yPosition);
            pdf.setFont(undefined, 'normal');
            yPosition += 6;
            
            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            irisIsoles.forEach(iris => {
                const irisNum = iris.properties.code_iris ? iris.properties.code_iris.slice(-4) : 'N/A';
                const irisName = iris.properties.nom_iris || '';
                const displayText = `  • ${irisNum} - ${irisName}`;
                
                // Gérer les noms longs en les coupant sur plusieurs lignes si nécessaire
                const maxWidth = columnWidth - 15;
                const textWidth = pdf.getTextWidth(displayText);
                
                if (textWidth > maxWidth && irisName.length > 20) {
                    // Couper le nom en deux parties
                    const firstPart = `  • ${irisNum} - ${irisName.substring(0, 15)}`;
                    const secondPart = `    ${irisName.substring(15)}`;
                    pdf.text(firstPart, xPosition + 8, yPosition);
                    yPosition += 4;
                    pdf.text(secondPart, xPosition + 8, yPosition);
                    yPosition += 4;
                } else {
                    pdf.text(displayText, xPosition + 8, yPosition);
                    yPosition += 4;
                }
            });
            yPosition += 4;
        }
        
        let statsY;
        if (columnCount >= 3 || yPosition > maxColumnHeight - 40) {
            pdf.addPage('a4', 'landscape');
            pdf.setFontSize(14);
            pdf.text('Statistiques', 15, 20);
            statsY = 40;
        } else {
            statsY = 175;
        }
        
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(15, statsY - 5, 270, 30);
        
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'bold');
        pdf.text('📊 Statistiques', 20, statsY);
        pdf.setFont(undefined, 'normal');
        
        pdf.setFontSize(10);
        const statsX1 = 20;
        const statsX2 = 100;
        const statsX3 = 180;
        
        pdf.text(`Total IRIS : ${currentCommuneData.irisFeatures.length}`, statsX1, statsY + 10);
        pdf.text(`Grands Quartiers : ${currentCommuneData.grandQuartiersMap.size}`, statsX2, statsY + 10);
        if (irisIsoles.length > 0) {
            pdf.text(`IRIS isolés : ${irisIsoles.length}`, statsX3, statsY + 10);
        }
        pdf.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, statsX1, statsY + 18);
        pdf.text(`Commune : ${currentCommuneData.name}`, statsX2, statsY + 18);
        
        
        pdf.save(`carte_${currentCommuneData.name}_${new Date().toISOString().split('T')[0]}.pdf`);
        
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
        document.body.removeChild(loadingMessage);
    }
}

// Fonction pour convertir hex en RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

resetButton.addEventListener('click', resetMap);
backButton.addEventListener('click', goBack);
exportButton.addEventListener('click', exportMap);

// Fonctions de zoom
function zoomIn() {
    map.zoomIn();
}

function zoomOut() {
    map.zoomOut();
}

zoomInButton.addEventListener('click', zoomIn);
zoomOutButton.addEventListener('click', zoomOut);