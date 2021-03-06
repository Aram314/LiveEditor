import {
  createElement, getElement, sortExplorer, checkExtension, getDirectChild, getPath,
} from '../helper.js';

class ExplorerView {
  constructor() {
    this.createFile = getElement('createFile');
    this.createFolder = getElement('createFolder');
    this.removeBtn = getElement('remove');
    this.renameBtn = getElement('rename');
    this.overlay = getElement('overlay');
    this.sidebarToggle = getElement('sidebar-toggle');

    this.root = getElement('root');
    this.list = createElement('ul');
    this.list.id = 'root_folder';

    this.rootContainer = createElement('ul');
    this.rootContainerTitle = createElement('li');
    this.selectedElement = this.rootContainerTitle;
    this.selectedElementPath = '';
    this.rootContainerTitle.classList.add('folder', 'expand', 'droppable');
    this.rootContainerTitle.setAttribute('data-name', 'Project');

    this.rootContainerTitle.addEventListener('click', this.setSelectedElement);
    this.rootContainerTitle.addEventListener('click', this.getPath);
    this.rootContainerTitle.addEventListener('click', this.expand);

    this.rootContainerTitle.addEventListener('mousedown', this.mouseDown);
    this.currentDroppable = null;
    this.draggingElement = null;
    this.copiedElementCreated = false;
    this.moveCounter = 0;

    this.rootContainerTitleText = createElement('span');
    this.rootContainerTitleText.innerHTML = 'Project';

    this.rootContainerTitle.append(this.rootContainerTitleText);
    this.rootContainer.append(this.rootContainerTitle);
    this.root.append(this.rootContainer);
    this.rootContainerTitle.append(this.list);

    this.createFile.onclick = this.clickCreate.bind(this, 'file');
    this.createFolder.onclick = this.clickCreate.bind(this, 'folder');
    this.removeBtn.addEventListener('click', this.clickRemove.bind(this));
    this.renameBtn.addEventListener('click', this.clickRename.bind(this));
    // resizing
    this.dragging = 0;
    this.body = document.body;
    this.dragbar = getElement('dragbar');

    this.dragbar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.dragging = 1;
      this.body.addEventListener('mousemove', this.resize);
      this.body.classList.add('resizing');
    });

    document.addEventListener('mouseup', () => {
      this.dragging ? this.clearJSEvents() : '';
    });

    this.sidebarToggle.addEventListener('click', () => {
      const container = getElement('container');
      const explorer = getElement('explorer');

      container.classList.toggle('explorer-closed');
      explorer.classList.toggle('explorer-closed');
    });
  }

  clearJSEvents = () => {
    this.dragging = 0;
    this.body.removeEventListener('mousemove', this.resize);
    this.body.classList.remove('resizing');
  };

  resize = (e) => {
    if (e.pageX < 200 || e.pageX > document.documentElement.clientWidth - 400) return;
    this.body.style.setProperty('--left-width', `${e.pageX}px`);
  };

  clickRemove = () => {
    if (this.selectedElement.dataset.name === 'Project') return;
    let selected;
    if (this.selectedElement.id === 'root') {
      selected = this.selectedElement;
    } else {
      selected = this.selectedElement.parentElement.parentElement;
    }
    const path = this.getPathPartial(selected);
    this.clickRemove();

    let el = this.root;
    for (const p of path) {
      el = getDirectChild(el, p);
    }

    this.highlight(el);

    this.selectedElement = el;
    this.selectedElementPath = path;
  };

  clickCreate = (type) => {
    let selected = this.selectedElement;
    if (selected.classList.contains('file')) {
      selected = selected.parentElement.parentElement;
    }

    this.overlay.style.display = 'block';
    const path = this.getPathPartial(selected);

    selected.classList.add('expand');

    this.expandInModel(true);

    const list = selected.querySelector('ul');

    const li = createElement('li');
    if (type === 'file') {
      li.classList.add('file', 'input');
    } else {
      li.classList.add('folder', 'input');
    }

    const input = createElement('input', null, 'create-input-field');

    li.append(input);
    list.prepend(li);

    const create = (e) => {
      const { target } = e;

      if (!target.value && li.parentElement || e.key === 'Escape') {
        try {
          li.remove();
        } catch (e) {
          console.log('');
        }
      } else {
        const creation = this.create(target.value, type);

        if (!creation) {
          const span = createElement('span', null, 'warning');
          span.textContent = `A file or folder '${target.value}' already exists at this location. Please choose a different name.`;
          target.parentElement.append(span);
          target.classList.add('danger');

          input.addEventListener('blur', () => {
            li.remove();

            this.overlay.style.display = 'none';
          });
          return;
        }

        let el = this.root;
        for (const p of path) {
          el = getDirectChild(el, p);
        }
        el = getDirectChild(el, target.value);

        this.highlight(el);

        this.selectedElementPath = this.getPathPartial(el);
        this.selectedElement = el;
      }
      this.overlay.style.display = 'none';
    };

    input.focus();
    input.addEventListener('keyup', (e) => {
      if (e.keyCode === 13) {
        input.removeEventListener('blur', create);
        create(e);
      } else if (e.keyCode === 27) {
        input.removeEventListener('blur', create);
        create(e);
      }
    });

    input.addEventListener('blur', create);
  };

  clickRename = () => {
    if (this.selectedElement.dataset.name === 'Project') return;
    this.selectedElement.classList.add('input');
    const input = createElement('input', null, 'rename-input');
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    this.overlay.style.display = 'block';
    input.value = this.selectedElement.dataset.name;
    this.selectedElement.querySelector('span').remove();
    this.selectedElement.prepend(input);
    input.focus();
    const index = input.value.indexOf('.');
    input.setSelectionRange(0, index);
    let fn;

    input.addEventListener('blur', fn = () => {
      const res = this.submitRename(input.value);
      const inputValue = input.value;
      if (res === 'nameEmpty') {
        const span = createElement('span', null, 'warning');
        span.textContent = 'A name must be provided!';
        input.parentElement.append(span);
        input.classList.add('danger');
        input.addEventListener('blur', () => {
          if (!input.value) {
            this.submitRename(this.selectedElement.dataset.name);
          }
        });
      } else if (res === 'nameExists') {
        const span = createElement('span', null, 'warning');
        span.textContent = `A file or folder '${input.value}' already exists at this location. Please choose a different name.`;
        input.parentElement.append(span);
        input.classList.add('danger');
        input.addEventListener('blur', () => {
          if (input.value === inputValue) {
            this.submitRename(this.selectedElement.dataset.name);
          }
        });
      }
    });
    input.addEventListener('keyup', (e) => {
      if (e.keyCode === 13) {
        const res = this.submitRename(input.value);
        const inputValue = input.value;
        if (res === 'nameEmpty') {
          const span = createElement('span', null, 'warning');
          span.textContent = 'A name must be provided!';
          input.parentElement.append(span);
          input.classList.add('danger');
          input.addEventListener('blur', () => {
            if (!input.value) {
              this.submitRename(this.selectedElement.dataset.name);
            }
          });
        } else if (res === 'nameExists') {
          const span = createElement('span', null, 'warning');
          span.textContent = `A file or folder '${input.value}' already exists at this location. Please choose a different name.`;
          input.parentElement.append(span);
          input.classList.add('danger');
          input.addEventListener('blur', () => {
            if (input.value === inputValue) {
              this.submitRename(this.selectedElement.dataset.name);
            }
          });
        }
      } else if (e.keyCode === 27) {
        input.removeEventListener('blur', fn);
        this.submitRename(this.selectedElement.dataset.name);
      }
    });
  };

  submitRename = (newName) => {
    if (this.selectedElement.parentElement.parentElement.id === 'root') {
      return true;
    }
    if (!newName.trim()) {
      return 'nameEmpty';
    }
    const siblings = this.selectedElement.parentElement.children;
    let isExistItemWithThatName = false;
    for (const sibling of siblings) {
      if (sibling === this.selectedElement) continue;
      if (sibling.dataset.name === newName) {
        isExistItemWithThatName = true;
      }
    }
    if (isExistItemWithThatName) return 'nameExists';

    this.rename(newName);
    const path = this.selectedElementPath.slice(0, this.selectedElementPath.length - 1);
    path.push(newName);

    let el = this.root;
    for (const item of path) {
      el = getDirectChild(el, item);
    }
    this.selectedElement = el;
    this.highlight(el);
    this.overlay.style.display = 'none';
  };

  mouseDown = (e) => {
    const self = this;
    const mouseDownEvent = e;
    const target = e.target.closest('.draggable');
    this.draggingElement = target;

    if (!target) return;

    let shiftX = mouseDownEvent.clientX - target.getBoundingClientRect().left;
    let shiftY = mouseDownEvent.clientY - target.getBoundingClientRect().top;
    let copiedTarget = target.cloneNode(true);

    function moveAt(pageX, pageY) {
      copiedTarget.style.left = pageX - shiftX + 'px';
      copiedTarget.style.top = pageY - shiftY + 'px';
    }

    function miangamkanchvoxfunction() {
      self.copiedElementCreated = true;

      if(copiedTarget.lastElementChild.tagName === 'UL') {
        copiedTarget.lastElementChild.remove();
      }
      copiedTarget.style.listStyleType = 'none';
      copiedTarget.style.position = 'absolute';
      copiedTarget.style.zIndex = 1000;
      copiedTarget.firstElementChild.classList.remove('selected');
      document.body.append(copiedTarget);

      moveAt(mouseDownEvent.pageX, mouseDownEvent.pageY);

      document.onmouseup = (e) => {
        self.copiedElementCreated = false;
        self.moveCounter = 0;

        if (!self.currentDroppable || !self.draggingElement) {
          self.draggingElement = null;

          document.removeEventListener('mousemove', onMouseMove);
          document.onmouseup = null;

          copiedTarget.remove();
          if (self.currentDroppable) {
            leaveDroppable(self.currentDroppable);
          }
          return
        }

        const draggableName = self.draggingElement.dataset.name;
        const droppableChildren = self.currentDroppable.lastElementChild.children;
        let isExist = false;

        for(let droppableChild of droppableChildren) {
          if(draggableName === droppableChild.dataset.name && self.draggingElement !== droppableChild) {
            isExist = true
          }
        }

        if(isExist) {
          self.showWarning(self.draggingElement.dataset.name, self.currentDroppable.dataset.name);

          self.draggingElement = null;

          copiedTarget.remove();
          if (self.currentDroppable) {
            leaveDroppable(self.currentDroppable);
          }
          isExist = false;

          document.removeEventListener('mousemove', onMouseMove);
          document.onmouseup = null;
          return
        }

        let dragEl = self.draggingElement;
        let dragPath = getPath(dragEl);

        let dropEl = self.currentDroppable;
        let dropPath = getPath(dropEl);

        copiedTarget.remove();
        if (self.currentDroppable) {
          leaveDroppable(self.currentDroppable);
        }


        const modelActivePath = self.move(dragPath, dropPath)[1];
        self.highlightByGivenPath(modelActivePath);
        self.draggingElement = null;

        document.removeEventListener('mousemove', onMouseMove);
        document.onmouseup = null;
      };
    }

    function onMouseMove(event) {
      self.moveCounter++;
      if(!self.copiedElementCreated && self.moveCounter > 10) {
        miangamkanchvoxfunction();
      }

      moveAt(event.pageX, event.pageY);

      copiedTarget.hidden = true;
      let elemBelow = document.elementFromPoint(event.clientX, event.clientY);
      copiedTarget.hidden = false;
      let droppableEl;
      if(elemBelow) {
        droppableEl = elemBelow.closest('.droppable');
      } else {
        return
      }

      if (self.currentDroppable !== droppableEl) {
        if (self.currentDroppable) {
          leaveDroppable(self.currentDroppable);
        }
        self.currentDroppable = droppableEl;
        if (self.currentDroppable) {
          enterDroppable(self.currentDroppable);
        }
      }

      if(target.contains(self.currentDroppable)) {
        leaveDroppable(self.currentDroppable);
        self.currentDroppable = null;
      }

    }

    document.addEventListener('mousemove', onMouseMove);

    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', onMouseMove)
    });

    function enterDroppable(elem) {
      elem.style.background = '#3A3D3F';
    }

    function leaveDroppable(elem) {
      elem.style.background = '';
    }

    copiedTarget.ondragstart = function() {
      return false;
    };
  };

  showWarning = (dragEl, dropEl) => {
    const warning = createElement('div', null, 'same-name-warning');
    warning.textContent = `There is file or folder with '${dragEl}' name in '${dropEl}' folder`;
    document.body.append(warning);
    setTimeout(() => {
      warning.remove()
    }, 2000)
  };

  renderExplorer(rootObj, list) {
    this.list.innerHTML = '';
    const self = this;
    function renderTree(rootObj, list) {
      if (rootObj) {
        const keys = Object.keys(rootObj.children);

        sortExplorer(keys, rootObj);

        for (const key of keys) {
          if (rootObj.children[key].type === 'file') {
            const listFileItem = document.createElement('li');
            listFileItem.setAttribute('data-name', key);
            listFileItem.classList.add('file', `${checkExtension(key)}`, 'draggable');
            listFileItem.addEventListener('click', self.setSelectedElement);
            const span = createElement('span');
            span.innerHTML = key;
            listFileItem.append(span);
            list.append(listFileItem);
          } else {
            const listFolderItem = document.createElement('li');
            listFolderItem.addEventListener('click', self.setSelectedElement);
            listFolderItem.setAttribute('data-name', key);
            if (rootObj.children[key].expanded) {
              listFolderItem.classList.add('expand');
            }
            listFolderItem.classList.add('folder', 'draggable', 'droppable');
            const span = createElement('span');
            span.innerHTML = key;
            listFolderItem.append(span);
            const innerList = document.createElement('ul');
            listFolderItem.append(innerList);
            list.append(listFolderItem);
            renderTree(rootObj.children[key], innerList);
          }
        }
      }
    }
    renderTree(rootObj, list);
  }

  setSelectedElement = (e) => {
    if (e.target.id === 'root_folder') return;
    const target = e.target.closest('li[data-name]');

    this.highlight(target);

    this.selectedElement = target;
  };

  highlight = (newElem) => {
    this.selectedElement.querySelector('span').classList.remove('selected');
    newElem.querySelector('span').classList.add('selected');
  };

  highlightByGivenPath = (givenPath) => {
    let el = this.root;
    for(let path of givenPath) {
      el = getDirectChild(el, path)
    }

    this.highlight(el);
    this.selectedElement = el;
    this.selectedElementPath = givenPath;
  };

  getPath = (e) => {
    let target = e.target.closest('li[data-name]');

    const path = [];
    while (target.id !== 'root') {
      path.unshift(target.dataset.name);
      target = target.parentElement.parentElement;
    }
    this.selectedElementPath = path;
    this.setActive(this.selectedElementPath);
  };

  getPathPartial = (el) => {
    const path = [];
    while (el.id !== 'root') {
      path.unshift(el.dataset.name);
      el = el.parentElement.parentElement;
    }

    return path;
  };

  expand = (e) => {
    if (e.target.closest('li.file') || e.target.id === 'root_folder' || e.target.classList.contains('create-input-field')) return;
    const target = e.target.closest('li.folder[data-name]');

    target.classList.toggle('expand');

    this.toggleExpanded(this.selectedElementPath);
  };

  makeRootActive = () => {
    this.selectedElement = this.rootContainerTitle;
  };

  bindOnCreate = (cb) => {
    this.create = cb;
  };

  bindSetActive(cb) {
    this.setActive = cb;
  }

  bindToggleExpanded(cb) {
    this.toggleExpanded = cb;
  }

  bindClickRemove(cb) {
    this.clickRemove = cb;
  }

  bindExpandInModel(cb) {
    this.expandInModel = cb;
  }

  bindRename(cb) {
    this.rename = cb;
  }

  bindMove(cb) {
    this.move = cb;
  }
}

export default ExplorerView;
