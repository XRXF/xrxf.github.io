class RXFConsole {
    constructor(element, inputElement, player) {
        this.element = element;
        this.inputElement = inputElement;
        this.player = player;
        this.history = [];
        this.historyIndex = 0;
        this.init();
    }
    
    init() {
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.execute(this.inputElement.value);
                this.inputElement.value = '';
            } else if (e.key === 'ArrowUp') {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.inputElement.value = this.history[this.historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.inputElement.value = this.history[this.historyIndex];
                } else {
                    this.historyIndex = this.history.length;
                    this.inputElement.value = '';
                }
            }
        });
    }
    
    log(msg, type = 'info') {
        const line = document.createElement('div');
        line.className = 'console-line';
        if (type === 'error') line.classList.add('console-error');
        const time = new Date().toLocaleTimeString();
        line.innerHTML = '[' + time + '] ' + msg;
        this.element.appendChild(line);
        this.element.scrollTop = this.element.scrollHeight;
    }
    
    clear() {
        this.element.innerHTML = '';
    }
    
    execute(cmd) {
        if (!cmd.trim()) return;
        
        this.history.push(cmd);
        this.historyIndex = this.history.length;
        this.log('> ' + cmd);
        
        try {
            if (cmd.startsWith('var ')) {
                const match = cmd.match(/var (\w+) = (.+)/);
                if (match && this.player) {
                    this.player.vars[match[1]] = eval(match[2]);
                    this.log(match[1] + ' = ' + this.player.vars[match[1]]);
                }
            } else if (cmd === 'clear') {
                this.clear();
            } else if (cmd === 'list') {
                if (this.player) {
                    this.log('Variables: ' + Object.keys(this.player.vars).join(', '));
                    this.log('Sprites: ' + this.player.sprites.size);
                    this.log('Instances: ' + this.player.instances.length);
                }
            } else if (cmd === 'frame') {
                if (this.player) this.log('Frame: ' + this.player.currentFrame + '/' + this.player.totalFrames);
            } else if (cmd.startsWith('goto ')) {
                const frame = parseInt(cmd.split(' ')[1]);
                if (this.player && !isNaN(frame)) this.player.gotoFrame(frame);
            } else if (cmd.startsWith('draw.')) {
                if (this.player && this.player.ctx) {
                    const match = cmd.match(/draw\.(\w+)\((.*)\)/);
                    if (match) {
                        const args = match[2].split(',').map(a => {
                            a = a.trim();
                            return this.player.vars[a] !== undefined ? this.player.vars[a] : eval(a);
                        });
                        this.player.ctx[match[1]](...args);
                        this.player.render();
                        this.log('OK');
                    }
                }
            } else if (cmd === 'play') {
                if (this.player) this.player.play();
            } else if (cmd === 'stop') {
                if (this.player) this.player.stop();
            } else {
                const result = eval(cmd);
                if (result !== undefined) this.log('= ' + result);
            }
        } catch(e) {
            this.log(e.message, 'error');
        }
    }
}