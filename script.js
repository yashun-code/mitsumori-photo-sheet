(() => {
  'use strict';

  const PAGE_SIZE = 6;
  const CANVAS_WIDTH = 3508;
  const CANVAS_HEIGHT = 2480;
  const state = {
    siteName: '', address: '', weekday: '', workMemo: '',
    photos: [], currentPage: 0, draggedId: null
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    siteName: $('site-name'), address: $('address'), weekday: $('weekday'), workMemo: $('work-memo'),
    dropzone: $('dropzone'), photoInput: $('photo-input'), thumbList: $('thumb-list'), addMore: $('add-more'),
    photoCount: $('photo-count'), pageTabs: $('page-tabs'), sheet: $('sheet'), pageDownloads: $('page-downloads'),
    copyMail: $('copy-mail'), downloadCurrent: $('download-current'), validation: $('validation-message')
  };

  const esc = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const pages = () => Math.max(1, Math.ceil(state.photos.length / PAGE_SIZE));
  const pagePhotos = (page) => state.photos.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const isValid = () => Boolean(state.siteName.trim() && state.address.trim());
  const safeFilePart = (name) => (name.trim() || '現場').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80);

  function bindField(element, key) {
    element.addEventListener('input', () => {
      state[key] = element.value;
      renderPreview();
      updateActions();
    });
  }

  function setup() {
    bindField(els.siteName, 'siteName');
    bindField(els.address, 'address');
    bindField(els.weekday, 'weekday');
    bindField(els.workMemo, 'workMemo');
    els.dropzone.addEventListener('click', (event) => {
      if (event.target !== els.photoInput) els.photoInput.click();
    });
    els.dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); els.photoInput.click(); }
    });
    els.photoInput.addEventListener('change', () => {
      addFiles(els.photoInput.files);
      els.photoInput.value = '';
    });
    ['dragenter', 'dragover'].forEach((type) => els.dropzone.addEventListener(type, (event) => {
      event.preventDefault(); els.dropzone.classList.add('is-dragover');
    }));
    ['dragleave', 'drop'].forEach((type) => els.dropzone.addEventListener(type, (event) => {
      event.preventDefault(); els.dropzone.classList.remove('is-dragover');
    }));
    els.dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
    els.addMore.addEventListener('click', () => els.photoInput.click());
    els.copyMail.addEventListener('click', copyMail);
    els.downloadCurrent.addEventListener('click', () => downloadPage(state.currentPage));
    renderAll();
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    files.forEach((file) => {
      const photo = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file), memo: '', image: null };
      state.photos.push(photo);
      loadImage(photo);
    });
    renderAll();
  }

  function loadImage(photo) {
    const image = new Image();
    image.onload = () => { photo.image = image; renderPreview(); };
    image.onerror = () => { photo.image = null; renderPreview(); };
    image.src = photo.url;
  }

  function renderAll() {
    const count = pages();
    if (state.currentPage >= count) state.currentPage = count - 1;
    renderThumbnails();
    renderTabs();
    renderPreview();
    renderPageDownloads();
    updateActions();
  }

  function renderThumbnails() {
    els.thumbList.innerHTML = '';
    state.photos.forEach((photo, index) => {
      const row = document.createElement('div');
      row.className = 'thumb-row'; row.draggable = true; row.dataset.id = photo.id;
      row.innerHTML = `<span class="drag-handle" title="ドラッグで並べ替え" aria-hidden="true">⠿</span>
        <span class="num">${index + 1}</span>
        <span class="thumb-img" role="img" aria-label="写真${index + 1}"></span>
        <input class="memo" type="text" maxlength="80" placeholder="一言メモ（任意）" value="${esc(photo.memo)}" aria-label="写真${index + 1}のメモ">
        <span class="move-buttons"><button class="move-btn up" type="button" title="上へ" aria-label="写真${index + 1}を上へ">↑</button><button class="move-btn down" type="button" title="下へ" aria-label="写真${index + 1}を下へ">↓</button></span>
        <button class="del" type="button" title="削除" aria-label="写真${index + 1}を削除">✕</button>`;
      row.querySelector('.thumb-img').style.backgroundImage = `url("${photo.url}")`;
      row.querySelector('.memo').addEventListener('input', (event) => { photo.memo = event.target.value; renderPreview(); });
      row.querySelector('.up').disabled = index === 0;
      row.querySelector('.down').disabled = index === state.photos.length - 1;
      row.querySelector('.up').addEventListener('click', () => movePhoto(index, -1));
      row.querySelector('.down').addEventListener('click', () => movePhoto(index, 1));
      row.querySelector('.del').addEventListener('click', () => removePhoto(photo.id));
      row.addEventListener('dragstart', (event) => { state.draggedId = photo.id; row.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', photo.id); });
      row.addEventListener('dragend', () => { state.draggedId = null; row.classList.remove('is-dragging'); row.classList.remove('is-over'); });
      row.addEventListener('dragover', (event) => { event.preventDefault(); if (state.draggedId !== photo.id) row.classList.add('is-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('is-over'));
      row.addEventListener('drop', (event) => { event.preventDefault(); row.classList.remove('is-over'); reorderPhoto(state.draggedId, photo.id); });
      els.thumbList.appendChild(row);
    });
    els.photoCount.textContent = state.photos.length ? `${state.photos.length}枚（${pages()}ページ）` : '写真はまだありません';
  }

  function movePhoto(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= state.photos.length) return;
    const [photo] = state.photos.splice(index, 1); state.photos.splice(target, 0, photo); renderAll();
  }

  function reorderPhoto(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const from = state.photos.findIndex((photo) => photo.id === fromId);
    const to = state.photos.findIndex((photo) => photo.id === toId);
    if (from < 0 || to < 0) return;
    const [photo] = state.photos.splice(from, 1); state.photos.splice(to, 0, photo); renderAll();
  }

  function removePhoto(id) {
    const index = state.photos.findIndex((photo) => photo.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(state.photos[index].url);
    state.photos.splice(index, 1); renderAll();
  }

  function renderTabs() {
    els.pageTabs.innerHTML = '';
    for (let page = 0; page < pages(); page += 1) {
      const tab = document.createElement('button');
      tab.className = `page-tab${state.currentPage === page ? ' active' : ''}`;
      tab.type = 'button'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(state.currentPage === page)); tab.textContent = `${page + 1}ページ目`;
      tab.addEventListener('click', () => { state.currentPage = page; renderTabs(); renderPreview(); updateActions(); });
      els.pageTabs.appendChild(tab);
    }
  }

  function renderPreview() {
    const photos = pagePhotos(state.currentPage);
    const date = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    els.sheet.innerHTML = `<div class="sheet-header"><div class="title-row"><h3 class="sheet-title">現場写真見積もり依頼</h3><span class="date">作成日：${date}</span></div><div class="sheet-meta"><div class="meta-row"><div><b>現場名</b>${esc(state.siteName) || '（未入力）'}</div><div><b>住所</b>${esc(state.address) || '（未入力）'}</div><div><b>希望曜日</b>${esc(state.weekday) || '指定なし'}</div></div><div class="memo-line"><b>作業内容</b>${esc(state.workMemo) || '（未入力）'}</div></div></div><div class="sheet-grid"></div>`;
    const grid = els.sheet.querySelector('.sheet-grid');
    for (let slot = 0; slot < PAGE_SIZE; slot += 1) {
      const photo = photos[slot];
      const card = document.createElement('div'); card.className = `photo-card${photo ? '' : ' empty'}`;
      if (photo) {
        card.innerHTML = `<span class="badge">${state.currentPage * PAGE_SIZE + slot + 1}</span><img class="photo-image" alt="写真${state.currentPage * PAGE_SIZE + slot + 1}">${photo.memo ? `<div class="photo-caption">${esc(photo.memo)}</div>` : ''}`;
        card.querySelector('img').src = photo.url;
      } else card.innerHTML = '<span class="empty-mark">＋</span>';
      grid.appendChild(card);
    }
  }

  function renderPageDownloads() {
    els.pageDownloads.innerHTML = '';
    for (let page = 0; page < pages(); page += 1) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'page-download'; button.textContent = `${page + 1}ページ目をPNG保存`;
      button.disabled = !isValid(); button.addEventListener('click', () => downloadPage(page)); els.pageDownloads.appendChild(button);
    }
  }

  function updateActions() {
    const valid = isValid();
    els.copyMail.disabled = !valid; els.downloadCurrent.disabled = !valid;
    els.validation.textContent = valid ? '入力内容はブラウザ内だけで処理されます' : '現場名と住所を入力すると操作できます';
    els.validation.classList.toggle('valid', valid);
    els.pageDownloads.querySelectorAll('button').forEach((button) => { button.disabled = !valid; });
  }

  function drawCover(ctx, image, x, y, width, height) {
    if (!image) return;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale; const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2; const sourceY = (image.naturalHeight - sourceHeight) / 2;
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function drawCanvas(page) {
    const canvas = document.createElement('canvas'); canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d'); const scale = CANVAS_WIDTH / 297; const photos = pagePhotos(page);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const left = 9.35 * scale; const right = 287.65 * scale; const top = 5.56 * scale;
    ctx.fillStyle = '#0d6e8f'; ctx.font = `700 ${6.2 * scale}px "Hiragino Sans", "Yu Gothic", sans-serif`; ctx.fillText('現場写真見積もり依頼', left, top + 6.2 * scale);
    ctx.fillStyle = '#6b756f'; ctx.font = `${3.2 * scale}px "Hiragino Sans", "Yu Gothic", sans-serif`; ctx.textAlign = 'right';
    ctx.fillText(`作成日：${new Intl.DateTimeFormat('ja-JP').format(new Date())}`, right, top + 5.2 * scale); ctx.textAlign = 'left';
    ctx.strokeStyle = '#0d6e8f'; ctx.lineWidth = 0.65 * scale; ctx.beginPath(); ctx.moveTo(left, top + 9.2 * scale); ctx.lineTo(right, top + 9.2 * scale); ctx.stroke();
    ctx.fillStyle = '#26302b'; ctx.font = `${3.35 * scale}px "Hiragino Sans", "Yu Gothic", sans-serif`;
    const metaY = top + 14.2 * scale; ctx.fillText(`現場名  ${state.siteName || '（未入力）'}`, left, metaY); ctx.fillText(`住所  ${state.address || '（未入力）'}`, left + 69 * scale, metaY); ctx.fillText(`希望曜日  ${state.weekday || '指定なし'}`, left + 178 * scale, metaY);
    ctx.fillStyle = '#6b756f'; ctx.font = `${3.1 * scale}px "Hiragino Sans", "Yu Gothic", sans-serif`; const memo = `作業内容  ${state.workMemo || '（未入力）'}`; ctx.fillText(memo.slice(0, 150), left, metaY + 5 * scale);
    const gridX = left; const gridY = top + 23 * scale; const gridW = right - left; const gridH = 176.4 * scale; const gap = 3 * scale; const cardW = (gridW - gap * 2) / 3; const cardH = (gridH - gap) / 2;
    for (let slot = 0; slot < PAGE_SIZE; slot += 1) {
      const x = gridX + (slot % 3) * (cardW + gap); const y = gridY + Math.floor(slot / 3) * (cardH + gap); const photo = photos[slot];
      ctx.fillStyle = photo ? '#eef1ef' : '#f7f8f7'; ctx.fillRect(x, y, cardW, cardH); ctx.strokeStyle = '#dde3df'; ctx.lineWidth = .35 * scale; ctx.strokeRect(x, y, cardW, cardH);
      if (photo && photo.image) drawCover(ctx, photo.image, x, y, cardW, cardH);
      if (!photo) { ctx.fillStyle = '#c3cac5'; ctx.font = `${8 * scale}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('+', x + cardW / 2, y + cardH / 2); ctx.textAlign = 'left'; }
      if (photo) {
        const badge = 7.3 * scale; ctx.fillStyle = '#e0672c'; ctx.beginPath(); ctx.arc(x + 8.5 * scale, y + 8.5 * scale, badge / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `700 ${3.7 * scale}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(String(page * PAGE_SIZE + slot + 1), x + 8.5 * scale, y + 9.8 * scale); ctx.textAlign = 'left';
        if (photo.memo) { const captionH = 8 * scale; const gradient = ctx.createLinearGradient(0, y + cardH - captionH * 2, 0, y + cardH); gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,.72)'); ctx.fillStyle = gradient; ctx.fillRect(x, y + cardH - captionH * 2, cardW, captionH * 2); ctx.fillStyle = '#fff'; ctx.font = `${3.1 * scale}px sans-serif`; ctx.fillText(photo.memo.slice(0, 44), x + 3 * scale, y + cardH - 3 * scale); }
      }
    }
    return canvas;
  }

  function downloadPage(page) {
    if (!isValid()) return;
    const canvas = drawCanvas(page); canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a'); const fileName = `現場写真一覧_${safeFilePart(state.siteName)}_${page + 1}.png`;
      link.download = fileName; link.href = URL.createObjectURL(blob); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  }

  function buildMail() {
    return `【見積もり依頼】${state.siteName.trim()}\n\nお世話になっております。\n下記現場の見積もりをお願いいたします。\n\n現場名：${state.siteName.trim()}\n住所：${state.address.trim()}\n希望曜日：${state.weekday.trim()}\n\n作業内容：\n${state.workMemo.trim()}\n\n現場写真は添付の画像をご確認ください（写真の番号と上記メモの番号が対応する場合はここに記載）。\n\nよろしくお願いいたします。`;
  }

  async function copyMail() {
    if (!isValid()) return;
    const text = buildMail();
    try { await navigator.clipboard.writeText(text); } catch (error) {
      const textarea = document.createElement('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    }
    const original = els.copyMail.textContent; els.copyMail.textContent = 'コピーしました'; setTimeout(() => { els.copyMail.textContent = original; }, 1600);
  }

  setup();
})();
