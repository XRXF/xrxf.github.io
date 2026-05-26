class RXFEditor {
    constructor() {
        this.project = {
            name: 'Untitled',
            objects: [],
            rooms: [{ id: 0, name: 'Room0', width: 800, height: 600, bgColor: '#ffffff', objects: [] }],
            sprites: [],
            sounds: [],
            scripts: [{ id: 'main', name: 'main.xfc', code: '// XFC Script\nvar x = 100\nvar y = 100\n\non frame each {\n    x = x + 1\n    if (x > 800) x = 0\n}' }],
            currentRoom: 0,
            currentFrame: 0,
            totalFrames: 120,
            fps: 24,
            gridEnabled: true,
            snapEnabled: true,
            gridSize: 32
        };
        this.selectedObject = null;
        this.selectedTool = 'select';
        this.dragging = false;
        this.dragStart = null;
        this.interval = null;
        this.player = null;
        this.console = null;
        this.zoom = 1;
        this.currentScriptId = 'main';
        this.init();
    }
    
    init() {
        this.canvas = document.getElementById('canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.loadFromStorage();
        this.setupEvents();
        this.setupTabs();
        this.render();
        this.updateUI();
        this.updateProjectTree();
        this.updateOutline();
        
        const consoleEl = document.getElementById('console');
        const consoleInput = document.getElementById('consoleInput');
        if (consoleEl && consoleInput) {
            this.console = new RXFConsole(consoleEl, consoleInput, null);
        }
        
        this.initCodeEditor();
        this.log('RXF Studio Pro ready');
        
        window.editor = this;
    }
    
    initCodeEditor() {
        const editor = document.getElementById('codeEditor');
        if (!editor) return;
        
        const script = this.project.scripts.find(s => s.id === this.currentScriptId);
        if (script) editor.value = script.code;
        
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
        });
        
        editor.addEventListener('keyup', () => {
            const lines = editor.value.substr(0, editor.selectionStart).split('\n');
            const cursorPos = document.getElementById('cursorPos');
            if (cursorPos) cursorPos.innerHTML = 'Ln ' + lines.length + ', Col ' + (lines[lines.length-1].length + 1);
            const codeLength = document.getElementById('codeLength');
            if (codeLength) codeLength.innerHTML = editor.value.length + ' chars';
        });
        
        const formatBtn = document.getElementById('codeFormat');
        if (formatBtn) formatBtn.onclick = () => this.formatCode();
        
        const runBtn = document.getElementById('codeRun');
        if (runBtn) runBtn.onclick = () => this.runScript();
        
        const saveBtn = document.getElementById('codeSave');
        if (saveBtn) saveBtn.onclick = () => this.saveCurrentScript();
    }
    
    formatCode() {
        const editor = document.getElementById('codeEditor');
        if (!editor) return;
        let code = editor.value;
        let indent = 0;
        let lines = code.split('\n');
        let formatted = [];
        
        for (let line of lines) {
            let trimmed = line.trim();
            if (trimmed.endsWith('}')) indent = Math.max(0, indent - 1);
            let spaces = '    '.repeat(indent);
            formatted.push(spaces + trimmed);
            if (trimmed.endsWith('{')) indent++;
        }
        
        editor.value = formatted.join('\n');
        this.log('Code formatted');
    }
    
    saveCurrentScript() {
        const editor = document.getElementById('codeEditor');
        if (!editor) return;
        const script = this.project.scripts.find(s => s.id === this.currentScriptId);
        if (script) {
            script.code = editor.value;
            this.saveToStorage();
            this.log('Script saved');
        }
    }
    
    runScript() {
        const editor = document.getElementById('codeEditor');
        if (!editor) return;
        if (this.console && this.console.player) {
            this.console.player.executeXFC(editor.value);
            this.log('Script executed');
        } else {
            this.log('No player running', 'error');
        }
    }
    
    loadFromStorage() {
        const saved = localStorage.getItem('rxf_project');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.scripts && parsed.scripts.length === 0) {
                    parsed.scripts = [{ id: 'main', name: 'main.xfc', code: '// XFC Script\nvar x = 100\nvar y = 100' }];
                }
                if (!parsed.sounds) parsed.sounds = [];
                this.project = parsed;
                this.log('Loaded saved project');
            } catch(e) {
                this.log('Error loading project', 'error');
            }
        }
    }
    
    saveToStorage() {
        localStorage.setItem('rxf_project', JSON.stringify(this.project));
        this.log('Project saved');
    }
    
    setupEvents() {
        const actions = {
            new: () => this.newProject(),
            open: () => this.openProject(),
            save: () => this.saveProject(),
            saveas: () => this.saveAs(),
            export: () => this.exportRXF(),
            exporthtml: () => this.exportHTML(),
            exit: () => this.exit(),
            run: () => this.run()
        };
        
        document.querySelectorAll('[data-action]').forEach(btn => {
            const action = btn.getAttribute('data-action');
            if (actions[action]) btn.onclick = actions[action];
        });
        
        const toolNew = document.getElementById('toolNew');
        if (toolNew) toolNew.onclick = () => this.newProject();
        
        const toolOpen = document.getElementById('toolOpen');
        if (toolOpen) toolOpen.onclick = () => this.openProject();
        
        const toolSave = document.getElementById('toolSave');
        if (toolSave) toolSave.onclick = () => this.saveProject();
        
        const toolUndo = document.getElementById('toolUndo');
        if (toolUndo) toolUndo.onclick = () => this.undo();
        
        const toolRedo = document.getElementById('toolRedo');
        if (toolRedo) toolRedo.onclick = () => this.redo();
        
        const toolPlay = document.getElementById('toolPlay');
        if (toolPlay) toolPlay.onclick = () => this.play();
        
        const toolStop = document.getElementById('toolStop');
        if (toolStop) toolStop.onclick = () => this.stop();
        
        const toolDebug = document.getElementById('toolDebug');
        if (toolDebug) toolDebug.onclick = () => this.debug();
        
        const toolRun = document.getElementById('toolRun');
        if (toolRun) toolRun.onclick = () => this.run();
        
        const toolExport = document.getElementById('toolExport');
        if (toolExport) toolExport.onclick = () => this.exportRXF();
        
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.onclick = () => this.play();
        
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) stopBtn.onclick = () => this.stop();
        
        const framePrev = document.getElementById('framePrev');
        if (framePrev) framePrev.onclick = () => this.prevFrame();
        
        const frameNext = document.getElementById('frameNext');
        if (frameNext) frameNext.onclick = () => this.nextFrame();
        
        const toolSelect = document.getElementById('toolSelect');
        if (toolSelect) toolSelect.onclick = () => this.setTool('select');
        
        const toolMove = document.getElementById('toolMove');
        if (toolMove) toolMove.onclick = () => this.setTool('move');
        
        const toolRect = document.getElementById('toolRect');
        if (toolRect) toolRect.onclick = () => this.setTool('rect');
        
        const toolCircle = document.getElementById('toolCircle');
        if (toolCircle) toolCircle.onclick = () => this.setTool('circle');
        
        const toolText = document.getElementById('toolText');
        if (toolText) toolText.onclick = () => this.setTool('text');
        
        const gridToggle = document.getElementById('gridToggle');
        if (gridToggle) gridToggle.onchange = (e) => { this.project.gridEnabled = e.target.checked; this.render(); };
        
        const snapToggle = document.getElementById('snapToggle');
        if (snapToggle) snapToggle.onchange = (e) => { this.project.snapEnabled = e.target.checked; };
        
        const gridSize = document.getElementById('gridSize');
        if (gridSize) gridSize.onchange = (e) => { this.project.gridSize = parseInt(e.target.value); this.render(); };
        
        const zoomIn = document.getElementById('zoomIn');
        if (zoomIn) zoomIn.onclick = () => { this.zoom = Math.min(this.zoom + 0.1, 3); this.updateZoom(); };
        
        const zoomOut = document.getElementById('zoomOut');
        if (zoomOut) zoomOut.onclick = () => { this.zoom = Math.max(this.zoom - 0.1, 0.3); this.updateZoom(); };
        
        const zoomFit = document.getElementById('zoomFit');
        if (zoomFit) zoomFit.onclick = () => { this.zoom = 1; this.updateZoom(); };
        
        const addSpriteBtn = document.getElementById('addSpriteBtn');
        if (addSpriteBtn) addSpriteBtn.onclick = () => document.getElementById('spriteUpload').click();
        
        const addSoundBtn = document.getElementById('addSoundBtn');
        if (addSoundBtn) addSoundBtn.onclick = () => document.getElementById('soundUpload').click();
        
        const spriteUpload = document.getElementById('spriteUpload');
        if (spriteUpload) spriteUpload.onchange = (e) => this.importSprites(e);
        
        const soundUpload = document.getElementById('soundUpload');
        if (soundUpload) soundUpload.onchange = (e) => this.importSounds(e);
        
        const clearConsoleBtn = document.getElementById('clearConsoleBtn');
        if (clearConsoleBtn) clearConsoleBtn.onclick = () => { if (this.console) this.console.clear(); };
        
        const closeConsoleBtn = document.getElementById('closeConsoleBtn');
        if (closeConsoleBtn) closeConsoleBtn.onclick = () => {
            const panel = document.querySelector('.panel-section.resizable');
            if (panel) panel.style.display = 'none';
        };
        
        const closePropsBtn = document.getElementById('closePropsBtn');
        if (closePropsBtn) closePropsBtn.onclick = () => {
            const panel = document.querySelector('.right-panel .panel-section:first-child');
            if (panel) panel.style.display = 'none';
        };
        
        document.querySelectorAll('.sidebar-tab').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panelId = btn.getAttribute('data-panel') + 'Panel';
                const panel = document.getElementById(panelId);
                if (panel) panel.classList.add('active');
            };
        });
        
        document.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.editor-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const tabId = tab.getAttribute('data-tab') + 'Tab';
                const content = document.getElementById(tabId);
                if (content) content.classList.add('active');
            };
        });
        
        if (this.canvas) {
            this.canvas.onmousedown = (e) => this.onMouseDown(e);
            this.canvas.onmousemove = (e) => this.onMouseMove(e);
            this.canvas.onmouseup = () => this.onMouseUp();
            this.canvas.onmouseleave = () => this.onMouseUp();
        }
        
        setInterval(() => this.updateStatus(), 100);
    }
    
    setupTabs() {}
    
    setTool(tool) {
        this.selectedTool = tool;
        document.querySelectorAll('.canvas-tools .tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('tool' + tool.charAt(0).toUpperCase() + tool.slice(1));
        if (activeBtn) activeBtn.classList.add('active');
    }
    
    updateZoom() {
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) zoomLevel.innerHTML = Math.round(this.zoom * 100) + '%';
        if (this.canvas) {
            this.canvas.style.transform = 'scale(' + this.zoom + ')';
            this.canvas.style.transformOrigin = 'center center';
        }
    }
    
    updateUI() {
        this.updateObjectList();
        this.updateRoomList();
        this.updateSpriteList();
        this.updateSoundList();
        this.updateScriptList();
    }
    
    updateProjectTree() {
        const container = document.getElementById('projectTree');
        if (!container) return;
        container.innerHTML = `
            <div class="tree-item" data-type="scripts"><iconify-icon icon="mdi:code-tags" width="14" height="14"></iconify-icon> Scripts (${this.project.scripts.length})</div>
            <div class="tree-item" data-type="objects"><iconify-icon icon="mdi:shape" width="14" height="14"></iconify-icon> Objects (${this.project.objects.length})</div>
            <div class="tree-item" data-type="rooms"><iconify-icon icon="mdi:view-dashboard" width="14" height="14"></iconify-icon> Rooms (${this.project.rooms.length})</div>
            <div class="tree-item" data-type="sprites"><iconify-icon icon="mdi:image" width="14" height="14"></iconify-icon> Sprites (${this.project.sprites.length})</div>
            <div class="tree-item" data-type="sounds"><iconify-icon icon="mdi:music" width="14" height="14"></iconify-icon> Sounds (${this.project.sounds.length})</div>
        `;
        container.querySelectorAll('.tree-item').forEach(el => {
            el.onclick = () => {
                const type = el.getAttribute('data-type');
                const tab = document.querySelector(`.sidebar-tab[data-panel="${type}"]`);
                if (tab) tab.click();
            };
        });
    }
    
    updateOutline() {
        const container = document.getElementById('outlineTree');
        if (!container) return;
        container.innerHTML = this.project.objects.map(obj => `
            <div class="tree-item" data-id="${obj.id}"><iconify-icon icon="mdi:shape" width="14" height="14"></iconify-icon> ${obj.name}</div>
        `).join('');
        container.querySelectorAll('.tree-item').forEach(el => {
            el.onclick = () => {
                const id = parseInt(el.getAttribute('data-id'));
                this.selectedObject = this.project.objects.find(o => o.id === id);
                this.updateProperties();
                this.render();
            };
        });
    }
    
    addObject() {
        const id = Date.now();
        this.project.objects.push({
            id: id,
            name: 'obj_' + id,
            x: 100,
            y: 100,
            width: 50,
            height: 50,
            color: '#ff0000',
            spriteId: null,
            scripts: []
        });
        this.updateUI();
        this.log('Added object: obj_' + id);
        this.saveToStorage();
    }
    
    addRoom() {
        const id = this.project.rooms.length;
        this.project.rooms.push({
            id: id,
            name: 'Room' + id,
            width: 800,
            height: 600,
            bgColor: '#ffffff',
            objects: []
        });
        this.updateUI();
        this.log('Added room: Room' + id);
        this.saveToStorage();
    }
    
    addScript() {
        const id = 'script_' + Date.now();
        this.project.scripts.push({
            id: id,
            name: id + '.xfc',
            code: '// XFC code here\nvar x = 0\nvar y = 0'
        });
        this.updateUI();
        this.log('Added script: ' + id);
        this.saveToStorage();
    }
    
    importSprites(e) {
        const files = Array.from(e.target.files);
        for (let file of files) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    this.project.sprites.push({
                        id: Date.now() + Math.random(),
                        name: file.name,
                        data: ev.target.result,
                        width: img.width,
                        height: img.height
                    });
                    this.updateUI();
                    this.log('Imported: ' + file.name);
                    this.saveToStorage();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
    
    importSounds(e) {
        const files = Array.from(e.target.files);
        for (let file of files) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.project.sounds.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    data: ev.target.result
                });
                this.updateUI();
                this.log('Imported sound: ' + file.name);
                this.saveToStorage();
            };
            reader.readAsDataURL(file);
        }
    }
    
    deleteSprite(id) {
        this.project.sprites = this.project.sprites.filter(s => s.id !== id);
        this.updateUI();
        this.log('Deleted sprite');
        this.saveToStorage();
    }
    
    deleteSound(id) {
        this.project.sounds = this.project.sounds.filter(s => s.id !== id);
        this.updateUI();
        this.log('Deleted sound');
        this.saveToStorage();
    }
    
    deleteObject(id) {
        this.project.objects = this.project.objects.filter(o => o.id !== id);
        if (this.selectedObject && this.selectedObject.id === id) this.selectedObject = null;
        this.updateUI();
        this.render();
        this.log('Deleted object');
        this.saveToStorage();
    }
    
    updateObjectList() {
        const container = document.getElementById('objectList');
        if (!container) return;
        container.innerHTML = '';
        for (let obj of this.project.objects) {
            const div = document.createElement('div');
            div.className = 'asset-item';
            div.setAttribute('data-id', obj.id);
            div.innerHTML = `
                <span><iconify-icon icon="mdi:shape" width="14" height="14"></iconify-icon> ${obj.name}</span>
                <button class="delete-btn" data-id="${obj.id}"><iconify-icon icon="mdi:close" width="12" height="12"></iconify-icon></button>
            `;
            div.onclick = (e) => {
                if (!e.target.closest('.delete-btn')) {
                    this.selectedObject = obj;
                    this.updateProperties();
                    this.render();
                }
            };
            const delBtn = div.querySelector('.delete-btn');
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteObject(obj.id);
                };
            }
            container.appendChild(div);
        }
    }
    
    updateRoomList() {
        const container = document.getElementById('roomList');
        if (!container) return;
        container.innerHTML = '';
        for (let room of this.project.rooms) {
            const div = document.createElement('div');
            div.className = 'asset-item';
            if (room.id === this.project.currentRoom) div.classList.add('selected');
            div.setAttribute('data-id', room.id);
            div.innerHTML = `<span><iconify-icon icon="mdi:view-dashboard" width="14" height="14"></iconify-icon> ${room.name}</span>`;
            div.onclick = () => {
                this.project.currentRoom = room.id;
                this.updateRoomList();
                this.render();
                this.log('Opened: ' + room.name);
            };
            container.appendChild(div);
        }
    }
    
    updateSpriteList() {
        const container = document.getElementById('spriteList');
        if (!container) return;
        container.innerHTML = '';
        for (let spr of this.project.sprites) {
            const div = document.createElement('div');
            div.className = 'asset-item';
            div.innerHTML = `
                <span><iconify-icon icon="mdi:image" width="14" height="14"></iconify-icon> ${spr.name}</span>
                <button class="delete-sprite" data-id="${spr.id}"><iconify-icon icon="mdi:close" width="12" height="12"></iconify-icon></button>
            `;
            const delBtn = div.querySelector('.delete-sprite');
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteSprite(spr.id);
                };
            }
            container.appendChild(div);
        }
    }
    
    updateSoundList() {
        const container = document.getElementById('soundList');
        if (!container) return;
        container.innerHTML = '';
        for (let snd of this.project.sounds) {
            const div = document.createElement('div');
            div.className = 'asset-item';
            div.innerHTML = `
                <span><iconify-icon icon="mdi:music" width="14" height="14"></iconify-icon> ${snd.name}</span>
                <button class="delete-sound" data-id="${snd.id}"><iconify-icon icon="mdi:close" width="12" height="12"></iconify-icon></button>
            `;
            const delBtn = div.querySelector('.delete-sound');
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteSound(snd.id);
                };
            }
            container.appendChild(div);
        }
    }
    
    updateScriptList() {
        const container = document.getElementById('scriptList');
        if (!container) return;
        container.innerHTML = '';
        for (let scr of this.project.scripts) {
            const div = document.createElement('div');
            div.className = 'asset-item';
            if (scr.id === this.currentScriptId) div.classList.add('selected');
            div.setAttribute('data-id', scr.id);
            div.innerHTML = `<span><iconify-icon icon="mdi:code-tags" width="14" height="14"></iconify-icon> ${scr.name}</span>`;
            div.onclick = () => {
                this.currentScriptId = scr.id;
                const editor = document.getElementById('codeEditor');
                if (editor) editor.value = scr.code;
                this.updateScriptList();
                this.log('Opened: ' + scr.name);
            };
            container.appendChild(div);
        }
    }
    
    updateProperties() {
        const container = document.getElementById('propertiesContent');
        if (!container) return;
        
        if (!this.selectedObject) {
            container.innerHTML = '<p style="color:#888">Select an object</p>';
            return;
        }
        
        container.innerHTML = `
            <label>Name: <input type="text" id="propName" value="${this.selectedObject.name}"></label>
            <label>X: <input type="number" id="propX" value="${this.selectedObject.x}"></label>
            <label>Y: <input type="number" id="propY" value="${this.selectedObject.y}"></label>
            <label>Width: <input type="number" id="propW" value="${this.selectedObject.width}"></label>
            <label>Height: <input type="number" id="propH" value="${this.selectedObject.height}"></label>
            <label>Color: <input type="color" id="propColor" value="${this.selectedObject.color}"></label>
            <label>Sprite: 
                <select id="propSprite">
                    <option value="">None</option>
                    ${this.project.sprites.map(s => `<option value="${s.id}" ${this.selectedObject.spriteId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </label>
            <button id="deleteObjBtn">Delete Object</button>
        `;
        
        const propName = document.getElementById('propName');
        if (propName) propName.onchange = (e) => { this.selectedObject.name = e.target.value; this.updateUI(); this.render(); this.saveToStorage(); };
        
        const propX = document.getElementById('propX');
        if (propX) propX.onchange = (e) => { this.selectedObject.x = this.snap(parseInt(e.target.value)); this.render(); this.saveToStorage(); };
        
        const propY = document.getElementById('propY');
        if (propY) propY.onchange = (e) => { this.selectedObject.y = this.snap(parseInt(e.target.value)); this.render(); this.saveToStorage(); };
        
        const propW = document.getElementById('propW');
        if (propW) propW.onchange = (e) => { this.selectedObject.width = parseInt(e.target.value); this.render(); this.saveToStorage(); };
        
        const propH = document.getElementById('propH');
        if (propH) propH.onchange = (e) => { this.selectedObject.height = parseInt(e.target.value); this.render(); this.saveToStorage(); };
        
        const propColor = document.getElementById('propColor');
        if (propColor) propColor.onchange = (e) => { this.selectedObject.color = e.target.value; this.render(); this.saveToStorage(); };
        
        const propSprite = document.getElementById('propSprite');
        if (propSprite) propSprite.onchange = (e) => { this.selectedObject.spriteId = e.target.value ? parseInt(e.target.value) : null; this.render(); this.saveToStorage(); };
        
        const deleteBtn = document.getElementById('deleteObjBtn');
        if (deleteBtn) deleteBtn.onclick = () => this.deleteObject(this.selectedObject.id);
    }
    
    snap(value) {
        if (this.project.snapEnabled) {
            return Math.round(value / this.project.gridSize) * this.project.gridSize;
        }
        return value;
    }
    
    render() {
        const room = this.project.rooms[this.project.currentRoom];
        if (!room || !this.ctx) return;
        
        this.canvas.width = room.width;
        this.canvas.height = room.height;
        
        this.ctx.fillStyle = room.bgColor;
        this.ctx.fillRect(0, 0, room.width, room.height);
        
        if (this.project.gridEnabled) {
            this.ctx.strokeStyle = '#ddd';
            this.ctx.lineWidth = 0.5;
            for (let x = 0; x < room.width; x += this.project.gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, room.height);
                this.ctx.stroke();
            }
            for (let y = 0; y < room.height; y += this.project.gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(room.width, y);
                this.ctx.stroke();
            }
        }
        
        for (let obj of this.project.objects) {
            const sprite = this.project.sprites.find(s => s.id === obj.spriteId);
            if (sprite && sprite.data) {
                const img = new Image();
                img.src = sprite.data;
                this.ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
            } else {
                this.ctx.fillStyle = obj.color;
                if (obj.isCircle) {
                    this.ctx.beginPath();
                    this.ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, obj.width/2, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.stroke();
                } else {
                    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                    this.ctx.strokeStyle = 'black';
                    this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                }
            }
            this.ctx.fillStyle = 'black';
            this.ctx.font = '10px monospace';
            this.ctx.fillText(obj.name, obj.x, obj.y - 3);
        }
        
        if (this.selectedObject) {
            this.ctx.strokeStyle = '#007acc';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.selectedObject.x - 2, this.selectedObject.y - 2, this.selectedObject.width + 4, this.selectedObject.height + 4);
        }
        
        const frameCount = document.getElementById('frameCount');
        if (frameCount) frameCount.innerHTML = this.project.currentFrame + '/' + this.project.totalFrames;
    }
    
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom;
        const y = (e.clientY - rect.top) / this.zoom;
        
        if (this.selectedTool === 'select') {
            for (let obj of this.project.objects) {
                if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
                    this.selectedObject = obj;
                    this.dragging = true;
                    this.dragStart = { x: x - obj.x, y: y - obj.y };
                    this.updateProperties();
                    this.render();
                    this.log('Selected: ' + obj.name);
                    break;
                }
            }
        } else if (this.selectedTool === 'rect') {
            const id = Date.now();
            this.project.objects.push({
                id: id,
                name: 'rect_' + id,
                x: this.snap(x - 25),
                y: this.snap(y - 25),
                width: 50,
                height: 50,
                color: '#00ff00',
                spriteId: null,
                scripts: []
            });
            this.updateUI();
            this.render();
            this.log('Added rectangle');
            this.saveToStorage();
        } else if (this.selectedTool === 'circle') {
            const id = Date.now();
            this.project.objects.push({
                id: id,
                name: 'circle_' + id,
                x: this.snap(x - 25),
                y: this.snap(y - 25),
                width: 50,
                height: 50,
                color: '#0000ff',
                isCircle: true,
                spriteId: null,
                scripts: []
            });
            this.updateUI();
            this.render();
            this.log('Added circle');
            this.saveToStorage();
        }
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom;
        const y = (e.clientY - rect.top) / this.zoom;
        const posText = document.getElementById('posText');
        if (posText) posText.innerHTML = Math.round(x) + ', ' + Math.round(y);
        
        if (this.dragging && this.selectedObject && this.selectedTool === 'select') {
            let newX = x - this.dragStart.x;
            let newY = y - this.dragStart.y;
            if (this.project.snapEnabled) {
                newX = Math.round(newX / this.project.gridSize) * this.project.gridSize;
                newY = Math.round(newY / this.project.gridSize) * this.project.gridSize;
            }
            this.selectedObject.x = newX;
            this.selectedObject.y = newY;
            this.render();
            this.updateObjectList();
        }
    }
    
    onMouseUp() {
        this.dragging = false;
        if (this.selectedObject) this.saveToStorage();
    }
    
    play() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            if (this.project.currentFrame < this.project.totalFrames - 1) {
                this.project.currentFrame++;
                this.render();
            } else {
                this.stop();
            }
        }, 1000 / this.project.fps);
        this.log('Play started');
    }
    
    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        this.project.currentFrame = 0;
        this.render();
        this.log('Stopped');
    }
    
    prevFrame() {
        if (this.project.currentFrame > 0) {
            this.project.currentFrame--;
            this.render();
        }
    }
    
    nextFrame() {
        if (this.project.currentFrame < this.project.totalFrames - 1) {
            this.project.currentFrame++;
            this.render();
        }
    }
    
    newProject() {
        if (confirm('Clear current project?')) {
            this.project = {
                name: 'Untitled',
                objects: [],
                rooms: [{ id: 0, name: 'Room0', width: 800, height: 600, bgColor: '#ffffff', objects: [] }],
                sprites: [],
                sounds: [],
                scripts: [{ id: 'main', name: 'main.xfc', code: '// XFC Script\nvar x = 100\nvar y = 100' }],
                currentRoom: 0,
                currentFrame: 0,
                totalFrames: 120,
                fps: 24,
                gridEnabled: true,
                snapEnabled: true,
                gridSize: 32
            };
            this.selectedObject = null;
            this.currentScriptId = 'main';
            this.updateUI();
            this.render();
            this.saveToStorage();
            this.log('New project created');
        }
    }
    
    openProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!parsed.sounds) parsed.sounds = [];
                    if (parsed.scripts && parsed.scripts.length === 0) {
                        parsed.scripts = [{ id: 'main', name: 'main.xfc', code: '// XFC Script' }];
                    }
                    this.project = parsed;
                    this.updateUI();
                    this.render();
                    this.log('Project opened: ' + file.name);
                } catch(err) {
                    this.log('Error opening project', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    saveProject() {
        const data = JSON.stringify(this.project, null, 2);
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.project.name + '.rxfproj';
        a.click();
        URL.revokeObjectURL(url);
        this.log('Project saved');
    }
    
    saveAs() {
        const name = prompt('Project name:', this.project.name);
        if (name) {
            this.project.name = name;
            this.saveProject();
        }
    }
    
    exportRXF() {
        const buffer = new ArrayBuffer(24);
        const view = new DataView(buffer);
        view.setUint32(0, 0x52584600);
        view.setUint8(4, 1);
        view.setUint8(5, 0);
        view.setUint16(6, 0, true);
        view.setUint32(8, 24, true);
        view.setUint32(20, 1, true);
        
        const blob = new Blob([buffer], {type: 'application/octet-stream'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.project.name + '.rxf';
        a.click();
        URL.revokeObjectURL(url);
        this.log('Exported to RXF');
    }
    
    exportHTML() {
        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${this.project.name}</title><script src="player.js"><\/script></head>
<body><div data-rxf="animation.rxf" width="800" height="600"></div></body>
</html>`;
        const blob = new Blob([html], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.project.name + '.html';
        a.click();
        URL.revokeObjectURL(url);
        this.log('Exported to HTML');
    }
    
    run() {
        this.log('Running project...');
        if (this.player) this.player.destroy();
        
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = '1000';
        container.style.background = '#1e1e1e';
        container.style.border = '1px solid #3c3c3c';
        container.style.borderRadius = '8px';
        container.style.padding = '10px';
        document.body.appendChild(container);
        
        this.player = new RXFPlayer(container, {
            width: 800,
            height: 600,
            fps: this.project.fps,
            loop: true
        });
        
        if (this.console) this.console.player = this.player;
        
        const fakeRXF = this.generateRXF();
        this.player.loadFromData(fakeRXF);
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<iconify-icon icon="mdi:close" width="16" height="16"></iconify-icon>';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '5px';
        closeBtn.style.right = '5px';
        closeBtn.style.background = '#ff4444';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.padding = '4px 8px';
        closeBtn.onclick = () => {
            if (this.player) this.player.destroy();
            container.remove();
            this.log('Runtime stopped');
        };
        container.appendChild(closeBtn);
    }
    
    generateRXF() {
        const buffer = new ArrayBuffer(24);
        const view = new DataView(buffer);
        view.setUint32(0, 0x52584600);
        view.setUint8(4, 1);
        view.setUint8(5, 0);
        view.setUint16(6, 0, true);
        view.setUint32(8, 24, true);
        view.setUint32(20, 1, true);
        return buffer;
    }
    
    undo() { this.log('Undo'); }
    redo() { this.log('Redo'); }
    debug() { this.log('Debug mode'); }
    exit() { if (confirm('Exit?')) window.close(); }
    
    updateStatus() {
        const statusText = document.getElementById('statusText');
        if (statusText) statusText.innerHTML = 'Ready - ' + this.project.objects.length + ' objects';
        
        const memoryStatus = document.getElementById('memoryStatus');
        if (memoryStatus && performance.memory) {
            const mem = Math.round(performance.memory.usedJSHeapSize / 1048576);
            memoryStatus.innerHTML = '<iconify-icon icon="mdi:memory" width="12" height="12"></iconify-icon> Mem: ' + mem + ' MB';
        }
        
        const fpsStatus = document.getElementById('fpsStatus');
        if (fpsStatus) {
            let fps = 0;
            if (this.interval) fps = Math.round(1000 / (1000 / this.project.fps));
            fpsStatus.innerHTML = '<iconify-icon icon="mdi:speedometer" width="12" height="12"></iconify-icon> FPS: ' + fps;
        }
    }
    
    log(msg, type = 'info') {
        if (this.console) {
            this.console.log(msg, type);
        } else {
            console.log(msg);
        }
    }
}

let editor;
document.addEventListener('DOMContentLoaded', () => {
    editor = new RXFEditor();
    window.editor = editor;
});