document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyCWEhKwyhe9GSB9PdloHm6sk5doE3XDzg4",
		authDomain: "mapa-de-portas-sw.firebaseapp.com",
		databaseURL: "https://mapa-de-portas-sw-default-rtdb.firebaseio.com",
		projectId: "mapa-de-portas-sw",
		storageBucket: "mapa-de-portas-sw.appspot.com",
		messagingSenderId: "95019148222",
		appId: "1:95019148222:web:0669dac2e3046df7770fef"
    };

    // --- INICIALIZAÇÃO DO FIREBASE ---
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const dbRef = database.ref('switches');

    // --- SELEÇÃO DOS ELEMENTOS GLOBAIS ---
    const switchRack = document.querySelector('.switch-rack');
    const searchBar = document.getElementById('search-bar');
    const addSwitchBtn = document.getElementById('add-switch-btn');
    const portModal = document.getElementById('port-modal');
    const portForm = document.getElementById('port-form');
    const addSwitchModal = document.getElementById('add-switch-modal');
    const addSwitchForm = document.getElementById('add-switch-form');
    const switchTemplateSelect = document.getElementById('switch-template');
    const editSwitchModal = document.getElementById('edit-switch-modal');
    const editSwitchForm = document.getElementById('edit-switch-form');

    // --- ESTRUTURA DE DADOS ---
    let appData = [];
    let currentEditing = { switchId: null, portId: null, type: null };

    // --- MODELOS DE SWITCHES ---
    const switchTemplates = {
        "Aruba-1930-48G": { name: "Aruba 1930 48G", model: "52 Portas (48 Cobre + 4 Fibra)", layout: [{ type: 'copper', columns: 24, count: 48 }, { type: 'sfp', columns: 2, count: 4 }] },
        "ECS2100-28T": { name: "Edge-Core ECS2100-28T", model: "28 Portas (24 Cobre + 4 Fibra)", layout: [{ type: 'copper', columns: 12, count: 24 }, { type: 'sfp', columns: 2, count: 4 }] },
        "Generic-24": { name: "Genérico 24 Portas", model: "24 Portas Cobre", layout: [{ type: 'copper', columns: 12, count: 24 }] }
    };

    // --- FUNÇÕES DE DADOS (FIREBASE) ---
    function listenForData() {
        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                appData = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
            } else {
                appData = [createSwitchObjectFromTemplate("Aruba-1930-48G", "Switch Principal (Exemplo)")];
                saveData();
            }
            renderAllSwitches();
        });
    }

    function saveData() {
        dbRef.set(appData);
    }

    function createSwitchObjectFromTemplate(templateKey, customName) {
        const template = switchTemplates[templateKey];
        return {
            id: `sw${Date.now()}`, name: customName, model: template.model,
            layout: template.layout, location: '', ip: '', assetId: '', 
            mac: '', url: '', ports: {}
        };
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderAllSwitches() {
        switchRack.innerHTML = '';
        appData.forEach(switchObj => {
            if (switchObj) {
                const switchElement = createSwitchElement(switchObj);
                switchRack.appendChild(switchElement);
            }
        });
        attachEventListeners();
    }

    function createSwitchElement(switchObj) {
        const switchDevice = document.createElement('div');
        switchDevice.className = 'switch-device';
        switchDevice.dataset.switchId = switchObj.id;

        const portsContainer = document.createElement('div');
        portsContainer.className = 'switch-ports';

        let portCounter = 1;
        (switchObj.layout || []).forEach(block => {
            const portBlock = document.createElement('div');
            portBlock.className = 'port-block';
            portBlock.style.gridTemplateColumns = `repeat(${block.count / 2}, 1fr)`;

            const oddPortsHTML = [];
            const evenPortsHTML = [];
            
            for (let i = 0; i < block.count; i++) {
                const portId = portCounter++;
                const portData = (switchObj.ports && switchObj.ports[portId]) ? switchObj.ports[portId] : {};
                let statusClass = '';
                if (portData.status === 'damaged') {
                    statusClass = 'status-damaged';
                } else if (portData.deviceType && portData.deviceType !== 'vazio') {
                    statusClass = 'status-active';
                }
                const portElementHTML = `<div class="port port-${block.type} ${statusClass}" data-port-id="${portId}" data-parent-switch="${switchObj.id}">${portId}</div>`;
                (portId % 2 !== 0) ? oddPortsHTML.push(portElementHTML) : evenPortsHTML.push(portElementHTML);
            }
            
            portBlock.innerHTML = oddPortsHTML.join('') + evenPortsHTML.join('');
            portsContainer.appendChild(portBlock);
        });
        
        const urlLink = switchObj.url ? `<a href="${switchObj.url}" target="_blank" title="${switchObj.url}">${switchObj.url}</a>` : 'N/A';

        const metadataHTML = `
            <div class="switch-metadata">
                <span>MODELO: ${switchObj.model || 'N/A'}</span>
                <span>IP: ${switchObj.ip || 'N/A'}</span>
                <span>MAC: ${switchObj.mac || 'N/A'}</span>
                <span>LINK: ${urlLink}</span>
                <span>PATRIMONIO: ${switchObj.assetId || 'N/A'}</span>
            </div>
        `;

        switchDevice.innerHTML = `
            <div class="switch-header">
                <div class="switch-info">
                    <h3 class="switch-name">${switchObj.name}</h3>
                    <div class="switch-model">${switchObj.location || 'Sem localização'}</div>
                </div>
                ${metadataHTML}
                <div class="switch-actions">
                    <button class="edit-switch-btn" title="Editar dados do switch">⚙️</button>
                    <button class="delete-switch-btn" title="Deletar switch">🗑️</button>
                </div>
            </div>`;
        switchDevice.appendChild(portsContainer);
        return switchDevice;
    }

    function populateSwitchTemplateOptions() {
        switchTemplateSelect.innerHTML = '';
        Object.keys(switchTemplates).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = switchTemplates[key].name;
            switchTemplateSelect.appendChild(option);
        });
    }

    // --- FUNÇÕES DE MODAL ---
    function openModal(modalElement, onOpen = () => {}) {
        onOpen();
        modalElement.style.display = 'flex';
    }

    function closeModal(modalElement) {
        modalElement.style.display = 'none';
    }
    
    // --- LÓGICA DE BUSCA ---
    function handleSearch() {
        const searchTerm = searchBar.value.toLowerCase();
        document.querySelectorAll('.switch-device').forEach(switchEl => {
            const switchId = switchEl.dataset.switchId;
            const switchObj = appData.find(sw => sw && sw.id === switchId);
            if (!switchObj) {
                switchEl.style.display = 'none';
                return;
            };

            let searchableText = Object.values(switchObj).join(' ');
            if (switchObj.ports) {
                searchableText += Object.values(switchObj.ports).map(p => Object.values(p).join(' ')).join(' ');
            }
            
            if (searchableText.toLowerCase().includes(searchTerm)) {
                switchEl.style.display = 'block';
            } else {
                switchEl.style.display = 'none';
            }
        });
    }

    // --- CONFIGURAÇÃO DOS EVENTOS ---
    function attachEventListeners() {
        document.querySelectorAll('.port').forEach(port => {
            port.addEventListener('click', (e) => {
                const switchId = e.currentTarget.dataset.parentSwitch;
                const portId = e.currentTarget.dataset.portId;
                openModal(portModal, () => {
                    currentEditing = { type: 'port', switchId, portId };
                    const switchObj = appData.find(sw => sw && sw.id === switchId);
                    if (!switchObj) return;
                    const portData = (switchObj.ports && switchObj.ports[portId]) ? switchObj.ports[portId] : {};
                    document.getElementById('modal-title').textContent = `Editando: ${switchObj.name} - Porta ${portId}`;
                    portForm.reset();
                    for(const key in portData) {
                        if(portForm.elements[key]) portForm.elements[key].value = portData[key];
                    }
                });
            });
        });
        
        document.querySelectorAll('.edit-switch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const switchId = e.target.closest('.switch-device').dataset.switchId;
                openModal(editSwitchModal, () => {
                    currentEditing = { type: 'switch', switchId };
                    const switchObj = appData.find(sw => sw && sw.id === switchId);
                    if (!switchObj) return;
                    editSwitchForm.elements.name.value = switchObj.name || '';
                    editSwitchForm.elements.location.value = switchObj.location || '';
                    editSwitchForm.elements.ip.value = switchObj.ip || '';
                    editSwitchForm.elements.mac.value = switchObj.mac || '';
                    editSwitchForm.elements.url.value = switchObj.url || '';
                    editSwitchForm.elements.assetId.value = switchObj.assetId || '';
                });
            });
        });

        document.querySelectorAll('.delete-switch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const switchId = e.target.closest('.switch-device').dataset.switchId;
                if (confirm(`Tem certeza que deseja deletar este switch e todas as suas configurações?`)) {
                    appData = appData.filter(sw => sw && sw.id !== switchId);
                    saveData();
                }
            });
        });
    }

    // --- EVENTOS GLOBAIS E DE FORMULÁRIO ---
    addSwitchBtn.addEventListener('click', () => openModal(addSwitchModal));

    addSwitchForm.addEventListener('submit', e => {
        e.preventDefault();
        const newSwitch = createSwitchObjectFromTemplate(e.target.elements.templateKey.value, e.target.elements.customName.value);
        appData.push(newSwitch);
        saveData();
        closeModal(addSwitchModal);
        e.target.reset();
    });

    editSwitchForm.addEventListener('submit', e => {
        e.preventDefault();
        if (currentEditing.type !== 'switch') return;
        const switchIndex = appData.findIndex(sw => sw && sw.id === currentEditing.switchId);
        if(switchIndex > -1) {
            appData[switchIndex].name = e.target.elements.name.value;
            appData[switchIndex].location = e.target.elements.location.value;
            appData[switchIndex].ip = e.target.elements.ip.value;
            appData[switchIndex].mac = e.target.elements.mac.value;
            appData[switchIndex].url = e.target.elements.url.value;
            appData[switchIndex].assetId = e.target.elements.assetId.value;
        }
        saveData();
        closeModal(editSwitchModal);
    });

    portForm.addEventListener('submit', e => {
        e.preventDefault();
        const { switchId, portId } = currentEditing;
        if (!switchId || !portId) return;
        const switchIndex = appData.findIndex(sw => sw && sw.id === switchId);
        if(switchIndex > -1) {
            const newPortData = Object.fromEntries(new FormData(portForm).entries());
            newPortData.status = 'active';
            if (!appData[switchIndex].ports) appData[switchIndex].ports = {};
            appData[switchIndex].ports[portId] = newPortData;
        }
        saveData();
        closeModal(portModal);
    });

    document.getElementById('clear-data-btn').addEventListener('click', () => {
        const { switchId, portId } = currentEditing;
        if (!switchId || !portId) return;
        const switchIndex = appData.findIndex(sw => sw && sw.id === switchId);
        if(switchIndex > -1 && appData[switchIndex].ports) {
            delete appData[switchIndex].ports[portId];
        }
        saveData();
        closeModal(portModal);
    });
    
    document.getElementById('mark-damaged-btn').addEventListener('click', () => {
        const { switchId, portId } = currentEditing;
        if (!switchId || !portId) return;
        const switchIndex = appData.findIndex(sw => sw && sw.id === switchId);
        if(switchIndex > -1) {
            if (!appData[switchIndex].ports) appData[switchIndex].ports = {};
            const portData = appData[switchIndex].ports[portId] || {};
            portData.status = 'damaged';
            appData[switchIndex].ports[portId] = portData;
        }
        saveData();
        closeModal(portModal);
    });
    
    [portModal, addSwitchModal, editSwitchModal].forEach(m => {
        if(m) {
            m.querySelector('.modal-close-btn').addEventListener('click', () => closeModal(m));
            m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
        }
    });

    searchBar.addEventListener('input', handleSearch);

    // --- INICIALIZAÇÃO ---
    populateSwitchTemplateOptions();
    listenForData();

});