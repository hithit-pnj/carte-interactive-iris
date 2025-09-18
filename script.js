let map = L.map('map').setView([46.603354, 1.888334], 6);
let osmLayer = null; // Déclaration globale de la couche OSM

// Fond de carte discret - Sauvegarde de la référence
osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap | Données IGN/INSEE',
    opacity: 0.4 // Rendre le fond de carte plus discret
}).addTo(map);

let currentLayer = null;
let history = [];
let departementsData = null;
let communesData = null;
let irisGrandQuartierMap = {}; // Correspondance IRIS -> Grand Quartier
let currentLevel = 'departements';
let currentGrandQuartiersMap = new Map(); // Stockage global de la map des grands quartiers
let currentCommuneNameGlobal = null; // Nom de la commune actuelle
const infoDiv = document.getElementById('info');
const loadingDiv = document.getElementById('loading');
const backButton = document.getElementById('backButton');
const resetButton = document.getElementById('resetButton');
const exportPdfButton = document.getElementById('exportPdfButton');
const fullscreenButton = document.getElementById('fullscreenButton');
const toggleSidebarButton = document.getElementById('toggleSidebarButton');
const toggleBackgroundButton = document.getElementById('toggleBackgroundButton');

// Palette de couleurs pour les grands quartiers
const grandQuartierColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#FFD93D', '#6BCB77', '#4D96FF',
    '#FF6F91', '#A8E6CF', '#FFD3B6', '#FFAAA5', '#FF8B94',
    '#C9B1FF', '#81C7DB', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#E74C3C', '#3498DB', '#2ECC71'
];

// Fonction pour générer le panneau de légende des grands quartiers
function generateGrandQuartierLegend(grandQuartiersMap, irisFeatures, communeName) {
    let legendHTML = `<h2 class="text-2xl font-bold mb-4 text-gray-800">Commune : ${communeName || 'N/A'}</h2>`;
    
    // Séparer les IRIS isolés
    const irisIsoles = irisFeatures.filter(f => !f.properties.grand_quartier);
    
    if (grandQuartiersMap.size === 0 && irisIsoles.length === irisFeatures.length) {
        legendHTML += `<div class="text-gray-600 mb-4">Tous les IRIS sont isolés (pas de grand quartier)</div>`;
        legendHTML += `<div class="text-sm text-gray-500">${irisFeatures.length} IRIS au total</div>`;
    } else {
        legendHTML += `<div class="mb-4">`;
        
        if (grandQuartiersMap.size > 0) {
            legendHTML += `<h3 class="text-lg font-semibold text-gray-700 mb-2">Grands Quartiers (${grandQuartiersMap.size})</h3>`;
        }
        
        // Afficher chaque grand quartier avec sa légende colorée
        legendHTML += '<div class="space-y-3">';
        
        grandQuartiersMap.forEach((info, gqCode) => {
            legendHTML += `
                <div class="border rounded-lg p-3 bg-gray-50 grand-quartier-legend" data-gq="${gqCode}">
                    <div class="flex items-center mb-2">
                        <div class="w-6 h-6 rounded mr-3 border border-gray-400" 
                             style="background-color: ${info.color}; opacity: 0.7;"></div>
                        <span class="font-medium text-gray-800">GQ ${gqCode}</span>
                        <span class="ml-auto text-sm text-gray-600">(${info.irisCount} IRIS)</span>
                    </div>
                    <details class="text-xs">
                        <summary class="cursor-pointer text-gray-600 hover:text-gray-800">
                            Voir les IRIS
                        </summary>
                        <div class="mt-2 pl-4 text-gray-500">
                            ${info.irisList.map(feature => {
                                const code = feature.properties.code_iris?.slice(-4) || 'N/A';
                                const nom = feature.properties.nom_iris || 'Sans nom';
                                return `<div>• ${code} - ${nom}</div>`;
                            }).join('')}
                        </div>
                    </details>
                </div>
            `;
        });
        
        // Afficher les IRIS isolés si il y en a
        if (irisIsoles.length > 0) {
            legendHTML += `
                <div class="border rounded-lg p-3 bg-gray-50 iris-isoles-legend">
                    <div class="flex items-center mb-2">
                        <div class="w-6 h-6 rounded mr-3 border border-gray-400" 
                             style="background-color: #6b7280; opacity: 0.7;"></div>
                        <span class="font-medium text-gray-800">IRIS Isolés</span>
                        <span class="ml-auto text-sm text-gray-600">(${irisIsoles.length} IRIS)</span>
                    </div>
                    <details class="text-xs">
                        <summary class="cursor-pointer text-gray-600 hover:text-gray-800">
                            Voir les IRIS
                        </summary>
                        <div class="mt-2 pl-4 text-gray-500">
                            ${irisIsoles.map(feature => {
                                const code = feature.properties.code_iris?.slice(-4) || 'N/A';
                                const nom = feature.properties.nom_iris || 'Sans nom';
                                return `<div>• ${code} - ${nom}</div>`;
                            }).join('')}
                        </div>
                    </details>
                </div>
            `;
        }
        
        legendHTML += '</div>';
        
        // Résumé
        legendHTML += `
            <div class="mt-4 pt-4 border-t text-sm text-gray-600">
                <div>Total : ${irisFeatures.length} IRIS</div>
                <div>${grandQuartiersMap.size} grands quartiers</div>
                ${irisIsoles.length > 0 ? `<div>${irisIsoles.length} IRIS isolés</div>` : ''}
            </div>
        `;
        
        legendHTML += '</div>';
    }
    
    return legendHTML;
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
    
    // Supprimer les labels d'IRIS si ils existent
    if (window.currentIrisLabels) {
        map.removeLayer(window.currentIrisLabels);
        window.currentIrisLabels = null;
    }
    
    // Réinitialiser les données globales pour l'export PDF si on n'est pas au niveau IRIS
    if (level !== 'iris') {
        currentGrandQuartiersMap = new Map();
        currentCommuneNameGlobal = null;
    }

    let features = [];
    let style = {};
    if (level === 'departements') {
        features = departementsData.features;
        style = { color: '#1e90ff', weight: 2, fillOpacity: 0.2 };
    } else if (level === 'communes') {
        features = communesData.features.filter(f => f.properties.code.slice(0, 2) === filterCode);
        style = { color: '#2ecc71', weight: 2, fillOpacity: 0.2 };
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
                    fillOpacity: 0.5,
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

function getTooltipContent(feature, level) {
    const props = feature.properties || {};
    if (level === 'departements') return `${props.nom || 'Inconnue'} (${props.code || 'N/A'})`;
    if (level === 'communes') return `${props.nom || 'Inconnue'} (${props.code || 'N/A'})`;
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
        } else if (level === 'communes') {
            content += `<p><strong>Nom:</strong> ${props.nom || 'Inconnue'}</p><p><strong>Code:</strong> ${props.code || 'N/A'}</p>`;
        }
        infoDiv.innerHTML = content;
    }
    // Pour les IRIS, pas de logique de sélection - la légende reste fixe
}

function drillDown(feature, level) {
    let nextLevel, code;
    const props = feature.properties || {};
    if (level === 'departements') {
        nextLevel = 'communes';
        code = props.code;
    } else if (level === 'communes') {
        nextLevel = 'iris';
        code = props.code;
        loadIrisForCommune(code);
        return;
    }
    if (!code) {
        alert('Code manquant pour le niveau suivant.');
        return;
    }
    showLevel(nextLevel, code);
}

function loadIrisForCommune(communeCode) {
    const depCode = communeCode.slice(0, 2);
    
    // Récupérer le nom de la commune depuis les données
    const communeFeature = communesData.features.find(f => f.properties.code === communeCode);
    const communeName = communeFeature ? communeFeature.properties.nom : communeCode;
    
    fetch(`data/iris_par_departement/iris_${depCode}.geojson`)
        .then(res => res.json())
        .then(irisData => {
            let irisFeatures = [];
            
            // Gestion spéciale pour Paris, Lyon et Marseille
            if (communeCode === '75056') {
                // Paris : tous les arrondissements (751xx)
                irisFeatures = irisData.features.filter(f => f.properties.code_insee.match(/^751\d{2}$/));
            } else if (communeCode === '69123') {
                // Lyon : tous les arrondissements (693xx)  
                irisFeatures = irisData.features.filter(f => f.properties.code_insee.match(/^693\d{2}$/));
            } else if (communeCode === '13055') {
                // Marseille : tous les arrondissements (132xx)
                irisFeatures = irisData.features.filter(f => f.properties.code_insee.match(/^132\d{2}$/));
            } else {
                // Commune normale
                irisFeatures = irisData.features.filter(f => f.properties.code_insee === communeCode);
            }
            
            if (irisFeatures.length === 0) {
                alert('Aucun IRIS trouvé pour cette commune.');
                return;
            }
            
            // Identifier les grands quartiers présents pour cette commune
            const grandQuartiersMap = new Map();
            const grandQuartierCounts = new Map(); // Compter les IRIS par grand quartier
            
            // Premier passage : compter les IRIS par grand quartier
            irisFeatures.forEach(feature => {
                const irisCode = feature.properties.code_iris;
                const grandQuartier = irisGrandQuartierMap[irisCode];
                
                if (grandQuartier) {
                    grandQuartierCounts.set(grandQuartier, (grandQuartierCounts.get(grandQuartier) || 0) + 1);
                }
            });
            
            // Deuxième passage : ne garder que les grands quartiers avec au moins 2 IRIS
            let colorIndex = 0;
            grandQuartierCounts.forEach((count, gqCode) => {
                if (count >= 2) {
                    grandQuartiersMap.set(gqCode, {
                        color: grandQuartierColors[colorIndex % grandQuartierColors.length],
                        irisCount: count,
                        irisList: []
                    });
                    colorIndex++;
                }
            });
            
            // Troisième passage : assigner les grands quartiers valides aux IRIS
            irisFeatures.forEach(feature => {
                const irisCode = feature.properties.code_iris;
                const grandQuartier = irisGrandQuartierMap[irisCode];
                
                if (grandQuartier && grandQuartiersMap.has(grandQuartier)) {
                    // Grand quartier valide (≥ 2 IRIS)
                    feature.properties.grand_quartier = grandQuartier;
                    grandQuartiersMap.get(grandQuartier).irisList.push(feature);
                } else {
                    // IRIS isolé (pas de grand quartier ou grand quartier avec < 2 IRIS)
                    feature.properties.grand_quartier = null;
                }
            });
            
            console.log(`Commune ${communeCode}: ${grandQuartiersMap.size} grands quartiers trouvés pour ${irisFeatures.length} IRIS`);
            
            if (currentLayer) map.removeLayer(currentLayer);
            
            // Style par défaut pour les IRIS isolés (gris)
            const defaultStyle = { color: '#6b7280', weight: 1, fillOpacity: 0.3, fillColor: '#6b7280' };
            
            currentLayer = L.geoJSON(irisFeatures, {
                style: (feature) => {
                    const grandQuartier = feature.properties.grand_quartier;
                    if (grandQuartier && grandQuartiersMap.has(grandQuartier)) {
                        const gqInfo = grandQuartiersMap.get(grandQuartier);
                        return {
                            color: gqInfo.color,
                            weight: 1.5,
                            fillOpacity: 0.4,
                            fillColor: gqInfo.color
                        };
                    }
                    return defaultStyle;
                },
                onEachFeature: (feature, layer) => {
                    const grandQuartier = feature.properties.grand_quartier;
                    const baseColor = grandQuartier && grandQuartiersMap.has(grandQuartier) 
                        ? grandQuartiersMap.get(grandQuartier).color 
                        : '#e74c3c';
                    
                    layer.bindPopup(getPopupContent(feature, 'iris'), {
                        className: 'custom-popup'
                    });
                    layer.bindTooltip(getTooltipContent(feature, 'iris'), {
                        direction: 'top',
                        offset: [0, -10],
                        className: 'custom-tooltip'
                    });
                    // Suppression de la logique de sélection d'IRIS
                    layer.on('mouseover', () => {
                        layer.setStyle({
                            fillOpacity: 0.7,
                            weight: 3,
                            color: baseColor
                        });
                    });
                    layer.on('mouseout', () => {
                        const gq = feature.properties.grand_quartier;
                        if (gq && grandQuartiersMap.has(gq)) {
                            layer.setStyle({
                                color: grandQuartiersMap.get(gq).color,
                                weight: 1.5,
                                fillOpacity: 0.4,
                                fillColor: grandQuartiersMap.get(gq).color
                            });
                        } else {
                            layer.setStyle(defaultStyle);
                        }
                    });
                }
            }).addTo(map);
            
            // Ajouter les labels des numéros d'IRIS sur la carte avec un meilleur positionnement
            const irisLabels = L.layerGroup();
            irisFeatures.forEach(feature => {
                const center = turf.centroid(feature);
                const coords = center.geometry.coordinates;
                const irisNumber = feature.properties.code_iris ? feature.properties.code_iris.slice(-4) : 'N/A';
                
                // Créer un label simple sans fond
                const label = L.marker([coords[1], coords[0]], {
                    icon: L.divIcon({
                        className: 'iris-label-marker',
                        html: `<div class="iris-label-content" style="
                            position: absolute;
                            left: 50%;
                            top: 50%;
                            transform: translate(-50%, -50%);
                            font-size: 11px; 
                            font-weight: bold; 
                            color: #333;
                            text-align: center;
                            white-space: nowrap;
                            pointer-events: none;
                            user-select: none;
                            text-shadow: 1px 1px 2px rgba(255,255,255,0.9), -1px -1px 2px rgba(255,255,255,0.9), 1px -1px 2px rgba(255,255,255,0.9), -1px 1px 2px rgba(255,255,255,0.9);
                        ">${irisNumber}</div>`,
                        iconSize: [40, 20],
                        iconAnchor: [20, 10]
                    }),
                    pane: 'markerPane' // S'assurer que les labels sont dans le bon pane
                });
                irisLabels.addLayer(label);
            });
            irisLabels.addTo(map);
            
            // Stocker la référence aux labels pour pouvoir les supprimer plus tard
            if (window.currentIrisLabels) {
                map.removeLayer(window.currentIrisLabels);
            }
            window.currentIrisLabels = irisLabels;
            
            // Ajustement du zoom pour les grandes villes
            if (communeCode === '75056' || communeCode === '69123' || communeCode === '13055') {
                // Pour Paris, Lyon, Marseille : zoom moins serré pour une meilleure vue d'ensemble
                const bounds = currentLayer.getBounds();
                map.fitBounds(bounds, { padding: [50, 50] }); // Plus de padding
                
                // Optionnel : limiter le zoom maximum pour éviter d'être trop proche
                setTimeout(() => {
                    if (map.getZoom() > 12) {
                        map.setZoom(12);
                    }
                }, 100);
            } else {
                // Zoom normal pour les autres communes
                map.fitBounds(currentLayer.getBounds());
            }
            currentLevel = 'iris';
            
            // Stocker globalement pour l'export PDF
            currentGrandQuartiersMap = grandQuartiersMap;
            currentCommuneNameGlobal = communeName;
            
            // Mettre à jour le panneau latéral avec la légende des grands quartiers
            const legendHTML = generateGrandQuartierLegend(grandQuartiersMap, irisFeatures, communeName);
            infoDiv.innerHTML = legendHTML;
            
            // Ajouter les event listeners pour le hover sur la légende
            setTimeout(() => {
                // Hover pour les grands quartiers
                document.querySelectorAll('.grand-quartier-legend').forEach(legendItem => {
                    const gqCode = legendItem.getAttribute('data-gq');
                    const gqInfo = grandQuartiersMap.get(gqCode);
                    
                    legendItem.addEventListener('mouseenter', () => {
                        // Opacifier tous les IRIS du grand quartier
                        currentLayer.eachLayer(layer => {
                            if (layer.feature && layer.feature.properties.grand_quartier === gqCode) {
                                layer.setStyle({
                                    fillOpacity: 0.8,
                                    weight: 3,
                                    color: gqInfo.color,
                                    fillColor: gqInfo.color
                                });
                            } else {
                                // Réduire l'opacité des autres IRIS
                                layer.setStyle({
                                    fillOpacity: 0.1,
                                    weight: 1
                                });
                            }
                        });
                    });
                    
                    legendItem.addEventListener('mouseleave', () => {
                        // Restaurer les styles normaux
                        currentLayer.eachLayer(layer => {
                            if (layer.feature) {
                                const grandQuartier = layer.feature.properties.grand_quartier;
                                if (grandQuartier && grandQuartiersMap.has(grandQuartier)) {
                                    const gqInfo = grandQuartiersMap.get(grandQuartier);
                                    layer.setStyle({
                                        color: gqInfo.color,
                                        weight: 1.5,
                                        fillOpacity: 0.4,
                                        fillColor: gqInfo.color
                                    });
                                } else {
                                    layer.setStyle(defaultStyle);
                                }
                            }
                        });
                    });
                });
                
                // Hover pour les IRIS isolés
                const irisIsolesLegend = document.querySelector('.iris-isoles-legend');
                if (irisIsolesLegend) {
                    irisIsolesLegend.addEventListener('mouseenter', () => {
                        // Opacifier tous les IRIS isolés
                        currentLayer.eachLayer(layer => {
                            if (layer.feature && !layer.feature.properties.grand_quartier) {
                                layer.setStyle({
                                    fillOpacity: 0.8,
                                    weight: 3,
                                    color: '#6b7280',
                                    fillColor: '#6b7280'
                                });
                            } else {
                                // Réduire l'opacité des autres IRIS
                                layer.setStyle({
                                    fillOpacity: 0.1,
                                    weight: 1
                                });
                            }
                        });
                    });
                    
                    irisIsolesLegend.addEventListener('mouseleave', () => {
                        // Restaurer les styles normaux
                        currentLayer.eachLayer(layer => {
                            if (layer.feature) {
                                const grandQuartier = layer.feature.properties.grand_quartier;
                                if (grandQuartier && grandQuartiersMap.has(grandQuartier)) {
                                    const gqInfo = grandQuartiersMap.get(grandQuartier);
                                    layer.setStyle({
                                        color: gqInfo.color,
                                        weight: 1.5,
                                        fillOpacity: 0.4,
                                        fillColor: gqInfo.color
                                    });
                                } else {
                                    layer.setStyle(defaultStyle);
                                }
                            }
                        });
                    });
                }
            }, 100); // Petit délai pour s'assurer que le DOM est mis à jour
            
            history.push({ level: 'iris', filterCode: communeCode, bounds: map.getBounds() });
            console.log('Exemple IRIS :', irisFeatures[0].properties);
            updateBackButton();
        })
        .catch(err => {
            console.error('Erreur chargement IRIS :', err);
            alert('Erreur lors du chargement des IRIS.');
        });
}

function goBack() {
    if (history.length > 1) {
        history.pop(); // Retirer l'état actuel
        const prev = history[history.length - 1];
        showLevel(prev.level, prev.filterCode);
        map.fitBounds(prev.bounds);
    } else {
        alert('Pas de niveau précédent.');
        history = [];
        showLevel('departements');
    }
}

function resetMap() {
    console.log('🔄 Rechargement complet de la page...');
    // Recharger complètement la page pour éviter tous les problèmes d'état
    window.location.reload();
}

function updateBackButton() {
    backButton.disabled = history.length <= 1;
}

resetButton.addEventListener('click', resetMap);
backButton.addEventListener('click', goBack);

// ==================== FONCTIONNALITÉ TOGGLE SIDEBAR ====================

let sidebarHidden = false;
let backgroundHidden = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mapContainer = document.getElementById('map').parentElement;
    
    if (!sidebarHidden) {
        // Masquer le sidebar SEULEMENT - SANS affecter le fond de carte
        sidebar.style.display = 'none';
        mapContainer.className = 'w-full relative';
        toggleSidebarButton.textContent = 'Afficher Menu';
        toggleSidebarButton.className = toggleSidebarButton.className.replace('bg-purple-600', 'bg-orange-600').replace('hover:bg-purple-700', 'hover:bg-orange-700');
        sidebarHidden = true;
        
        // Recalculer UNIQUEMENT la taille de la carte
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
        
        console.log('📱 Sidebar masqué - carte élargie (fond OSM préservé)');
    } else {
        // Afficher le sidebar SEULEMENT - SANS affecter le fond de carte
        sidebar.style.display = '';
        mapContainer.className = 'w-3/4 relative';
        toggleSidebarButton.textContent = 'Masquer Menu';
        toggleSidebarButton.className = toggleSidebarButton.className.replace('bg-orange-600', 'bg-purple-600').replace('hover:bg-orange-700', 'hover:bg-purple-700');
        sidebarHidden = false;
        
        // Recalculer UNIQUEMENT la taille de la carte
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
        
        console.log('📱 Sidebar affiché - vue normale (fond OSM préservé)');
    }
}

toggleSidebarButton.addEventListener('click', toggleSidebar);

// ==================== FONCTIONNALITÉ TOGGLE BACKGROUND ====================

function toggleBackground() {
    if (!osmLayer) {
        console.error('Couche OSM non trouvée');
        return;
    }
    
    if (!backgroundHidden) {
        // Masquer le fond de carte et mettre un fond blanc
        osmLayer.setOpacity(0);
        document.getElementById('map').style.backgroundColor = '#ffffff';
        toggleBackgroundButton.textContent = 'Afficher Fond';
        toggleBackgroundButton.className = toggleBackgroundButton.className.replace('bg-indigo-600', 'bg-amber-600').replace('hover:bg-indigo-700', 'hover:bg-amber-700');
        backgroundHidden = true;
        console.log('🗺️ Fond de carte masqué - Fond blanc activé');
    } else {
        // Afficher le fond de carte et enlever le fond blanc
        osmLayer.setOpacity(0.4);
        document.getElementById('map').style.backgroundColor = '';
        toggleBackgroundButton.textContent = 'Masquer Fond';
        toggleBackgroundButton.className = toggleBackgroundButton.className.replace('bg-amber-600', 'bg-indigo-600').replace('hover:bg-amber-700', 'hover:bg-indigo-700');
        backgroundHidden = false;
        console.log('🗺️ Fond de carte affiché - Fond blanc désactivé');
    }
}

toggleBackgroundButton.addEventListener('click', toggleBackground);

// ==================== MODE PLEIN ÉCRAN ULTRA-SIMPLE ====================

let isFullscreen = false;
let fullscreenOriginalState = null;

function toggleFullscreen() {
    if (!isFullscreen) {
        enterFullscreenMode();
    } else {
        exitFullscreenMode();
    }
}

function enterFullscreenMode() {
    console.log('📺 Entrée en mode plein écran - AUCUNE modification du fond de carte');
    
    // VÉRIFICATION : État du fond AVANT le plein écran
    const osmOpacityBefore = osmLayer ? osmLayer.options.opacity : 'undefined';
    const backgroundStateBefore = backgroundHidden;
    console.log('🔍 AVANT plein écran - OSM opacity:', osmOpacityBefore, 'backgroundHidden:', backgroundStateBefore);
    
    // Sauvegarder UNIQUEMENT les éléments visuels
    const sidebar = document.getElementById('sidebar');
    const controls = document.querySelector('.absolute.top-4.left-4');
    const mapParent = document.getElementById('map').parentElement;
    
    fullscreenOriginalState = {
        sidebarDisplay: sidebar.style.display,
        controlsDisplay: controls.style.display,
        mapParentClass: mapParent.className
    };
    
    // Modifications UNIQUEMENT visuelles
    sidebar.style.display = 'none';
    controls.style.display = 'none';
    mapParent.className = 'fixed inset-0 z-50';
    document.getElementById('map').className = 'w-full h-full';
    
    // Bouton de sortie
    const exitBtn = document.createElement('button');
    exitBtn.id = 'fullscreen-exit';
    exitBtn.innerHTML = '❌ Sortir';
    exitBtn.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 z-[1001]';
    exitBtn.onclick = exitFullscreenMode;
    document.body.appendChild(exitBtn);
    
    // Redimensionner la carte
    setTimeout(() => map.invalidateSize(), 100);
    
    // VÉRIFICATION : État du fond APRÈS le plein écran
    setTimeout(() => {
        const osmOpacityAfter = osmLayer ? osmLayer.options.opacity : 'undefined';
        const backgroundStateAfter = backgroundHidden;
        console.log('🔍 APRÈS plein écran - OSM opacity:', osmOpacityAfter, 'backgroundHidden:', backgroundStateAfter);
        
        if (osmOpacityBefore !== osmOpacityAfter || backgroundStateBefore !== backgroundStateAfter) {
            console.error('❌ PROBLÈME : Le fond de carte a été modifié !');
        } else {
            console.log('✅ OK : Le fond de carte n\'a pas été modifié');
        }
    }, 200);
    
    isFullscreen = true;
}

function exitFullscreenMode() {
    if (!fullscreenOriginalState) return;
    
    console.log('📺 Sortie du mode plein écran - Restauration interface uniquement');
    
    // Restaurer UNIQUEMENT l'affichage
    const sidebar = document.getElementById('sidebar');
    const controls = document.querySelector('.absolute.top-4.left-4');
    const mapParent = document.getElementById('map').parentElement;
    
    sidebar.style.display = fullscreenOriginalState.sidebarDisplay;
    controls.style.display = fullscreenOriginalState.controlsDisplay;
    mapParent.className = fullscreenOriginalState.mapParentClass;
    document.getElementById('map').className = 'h-full';
    
    // Supprimer le bouton de sortie
    const exitBtn = document.getElementById('fullscreen-exit');
    if (exitBtn) document.body.removeChild(exitBtn);
    
    // Redimensionner la carte
    setTimeout(() => map.invalidateSize(), 100);
    
    isFullscreen = false;
    fullscreenOriginalState = null;
}

fullscreenButton.addEventListener('click', toggleFullscreen);

// ==================== FONCTIONS EXPORT PDF (LÉGENDE SEULEMENT) ====================

// Fonction d'export PDF - LÉGENDE SEULEMENT
async function exportToPDFLegendOnly() {
    try {
        console.log('📄 Export PDF - Légende uniquement...');
        
        if (!window.jspdf) {
            alert('Erreur: Bibliothèque jsPDF non chargée');
            return;
        }
        
        // Vérifier qu'on a des données à exporter
        if (!currentGrandQuartiersMap || currentGrandQuartiersMap.size === 0) {
            alert('Aucune légende à exporter. Naviguez d\'abord vers une commune avec des IRIS.');
            return;
        }
        
        // Afficher le loading
        loadingDiv.style.display = 'flex';
        loadingDiv.innerHTML = '<div class="text-lg font-semibold text-gray-700 animate-pulse">Génération de la légende PDF...</div>';
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        // Créer directement la légende
        createBeautifulLegendPage(pdf, currentGrandQuartiersMap, currentCommuneNameGlobal);
        
        // Sauvegarder
        const communeName = currentCommuneNameGlobal || 'commune';
        const filename = `legende_${communeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);
        
        loadingDiv.style.display = 'none';
        alert('PDF de légende généré avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur export PDF légende:', error);
        loadingDiv.style.display = 'none';
        alert('Erreur lors de la génération du PDF: ' + (error.message || 'Erreur inconnue'));
    }
}

// Fonction pour créer une belle légende avec couleurs et noms
function createBeautifulLegendPage(pdf, grandQuartiersMap, communeName) {
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 25;
    
    // En-tête avec titre principal
    pdf.setFillColor(52, 152, 219); // Bleu
    pdf.rect(0, 0, pdfWidth, 20, 'F');
    
    pdf.setTextColor(255, 255, 255); // Blanc
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('LÉGENDE DES GRANDS QUARTIERS', 15, 13);
    
    // Retour au noir pour le reste
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;
    
    // Informations de la commune
    if (communeName) {
        pdf.setFontSize(16);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Commune: ${communeName}`, 15, yPosition);
        yPosition += 8;
    }
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 15, yPosition);
    yPosition += 15;
    
    // Ligne de séparation
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(15, yPosition, pdfWidth - 15, yPosition);
    yPosition += 15;
    
    // Parcourir chaque grand quartier avec un design amélioré
    grandQuartiersMap.forEach((info, gqCode) => {
        // Vérifier si on a assez de place pour un bloc complet
        const estimatedHeight = 12 + (Math.ceil(info.irisList.length / 3) * 4);
        if (yPosition + estimatedHeight > pdfHeight - 20) {
            pdf.addPage();
            yPosition = 20;
        }
        
        // Fond gris clair pour chaque grand quartier
        pdf.setFillColor(248, 249, 250);
        pdf.rect(10, yPosition - 3, pdfWidth - 20, estimatedHeight, 'F');
        
        // Bordure du bloc
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.rect(10, yPosition - 3, pdfWidth - 20, estimatedHeight, 'S');
        
        // Carré de couleur plus grand et plus beau
        const rgb = hexToRgb(info.color);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(15, yPosition - 1, 12, 8, 'F');
        
        // Bordure du carré de couleur
        pdf.setDrawColor(100, 100, 100);
        pdf.setLineWidth(0.5);
        pdf.rect(15, yPosition - 1, 12, 8, 'S');
        
        // Titre du grand quartier
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Grand Quartier ${gqCode}`, 32, yPosition + 4);
        
        // Nombre d'IRIS
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'normal');
        pdf.text(`(${info.irisCount} IRIS)`, 100, yPosition + 4);
        yPosition += 12;
        
        // Liste des IRIS en colonnes
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        
        const irisPerRow = 3;
        const colWidth = (pdfWidth - 60) / irisPerRow;
        
        info.irisList.forEach((feature, index) => {
            const code = feature.properties.code_iris?.slice(-4) || 'N/A';
            const nom = feature.properties.nom_iris || 'Sans nom';
            const irisText = `• ${code} - ${nom}`;
            
            const col = index % irisPerRow;
            const row = Math.floor(index / irisPerRow);
            
            const xPos = 20 + (col * colWidth);
            const yPos = yPosition + (row * 4);
            
            // Limiter la longueur du texte pour éviter les débordements
            const maxLength = 25;
            const displayText = irisText.length > maxLength ? 
                irisText.substring(0, maxLength) + '...' : irisText;
            
            pdf.text(displayText, xPos, yPos);
        });
        
        // Ajuster yPosition selon le nombre de lignes d'IRIS
        const irisRows = Math.ceil(info.irisList.length / irisPerRow);
        yPosition += (irisRows * 4) + 8;
    });
    
    // Pied de page avec style
    pdf.setFillColor(240, 240, 240);
    pdf.rect(0, pdfHeight - 15, pdfWidth, 15, 'F');
    
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Document généré automatiquement le ${new Date().toLocaleString('fr-FR')}`, 15, pdfHeight - 5);
}

// Fonction utilitaire pour convertir hex en RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// Event listener pour le bouton d'export PDF - Légende seulement
exportPdfButton.addEventListener('click', exportToPDFLegendOnly);
