(function () {
  'use strict';

  var MIN_SCALE = 1;
  var MAX_SCALE = 4;
  var WHEEL_STEP = 0.12;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function Comparison(root) {
    this.root = root;
    this.viewport = root.querySelector('.fl-comparison__viewport');
    this.stage = root.querySelector('.fl-comparison__stage');
    this.afterLayer = root.querySelector('.fl-comparison__after');
    this.beforeWrap = root.querySelector('.fl-comparison__before-wrap');
    this.beforeLayer = root.querySelector('.fl-comparison__before');
    this.divider = root.querySelector('.fl-comparison__divider');
    this.handle = root.querySelector('.fl-comparison__handle');
    this.fullscreenBtn = root.querySelector('.fl-comparison__fullscreen');

    this.position = 50;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.baseWidth = 0;
    this.baseHeight = 0;
    this.fitWidth = 0;
    this.aspectRatio = 16 / 9;

    this.dragMode = null;
    this.dragStart = null;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onFullscreenChange = this.onFullscreenChange.bind(this);
    this.onFullscreenClick = this.onFullscreenClick.bind(this);

    this.init();
  }

  Comparison.prototype.init = function () {
    if (
      !this.viewport ||
      !this.stage ||
      !this.afterLayer ||
      !this.beforeWrap ||
      !this.beforeLayer ||
      !this.handle
    ) {
      return;
    }

    this.loadImages()
      .then(this.setupLayout.bind(this))
      .catch(function () {});
  };

  Comparison.prototype.createImage = function (url, alt) {
    var img = document.createElement('img');
    img.className = 'fl-comparison__img';
    img.src = url;
    img.alt = alt;
    img.decoding = 'async';
    img.draggable = false;
    return img;
  };

  Comparison.prototype.loadImages = function () {
    var beforeUrl = this.root.dataset.before;
    var afterUrl = this.root.dataset.after;
    var caption = this.root.dataset.scene || 'Comparison';

    if (!beforeUrl || !afterUrl) {
      return Promise.reject(new Error('Missing image URLs'));
    }

    var beforeImg = this.createImage(
      beforeUrl,
      caption + ' — shipped (before)',
    );
    var afterImg = this.createImage(
      afterUrl,
      caption + ' — FaithfulLuma (after)',
    );

    this.afterLayer.appendChild(afterImg);
    this.beforeLayer.appendChild(beforeImg);
    this.beforeImg = beforeImg;
    this.afterImg = afterImg;

    var self = this;

    return Promise.all([
      new Promise(function (resolve, reject) {
        beforeImg.addEventListener('load', resolve, { once: true });
        beforeImg.addEventListener('error', reject, { once: true });
      }),
      new Promise(function (resolve, reject) {
        afterImg.addEventListener('load', resolve, { once: true });
        afterImg.addEventListener('error', reject, { once: true });
      }),
    ]).then(function () {
      if (beforeImg.naturalWidth && beforeImg.naturalHeight) {
        self.aspectRatio = beforeImg.naturalWidth / beforeImg.naturalHeight;
      }
    });
  };

  Comparison.prototype.setupLayout = function () {
    this.updateBaseSize();
    this.setPosition(this.position);
    this.applyTransform();
    this.bindEvents();
  };

  Comparison.prototype.bindEvents = function () {
    this.handle.addEventListener('pointerdown', this.onPointerDown);
    this.viewport.addEventListener('pointerdown', this.onPointerDown);
    this.viewport.addEventListener('wheel', this.onWheel, { passive: false });
    this.viewport.addEventListener('dblclick', this.onDoubleClick);
    this.handle.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', this.onFullscreenClick);
    }
  };

  Comparison.prototype.onResize = function () {
    var oldBaseWidth = this.baseWidth;
    if (!oldBaseWidth) {
      return;
    }

    this.updateBaseSize();
    var ratio = this.baseWidth / oldBaseWidth;
    this.translateX *= ratio;
    this.translateY *= ratio;
    this.applyTransform();
  };

  Comparison.prototype.updateBaseSize = function () {
    this.baseWidth = this.viewport.clientWidth;
    this.baseHeight = this.baseWidth / this.aspectRatio;

    if (!this.isFullscreen()) {
      this.fitWidth = this.baseWidth;
      this.viewport.style.height = this.baseHeight + 'px';
    }
  };

  Comparison.prototype.getMaxScale = function () {
    if (!this.beforeImg || !this.beforeImg.naturalWidth) {
      return MAX_SCALE;
    }

    var refWidth = this.fitWidth || this.baseWidth;
    if (!refWidth) {
      return MAX_SCALE;
    }

    var nativeScale = this.beforeImg.naturalWidth / refWidth;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, nativeScale));
  };

  Comparison.prototype.getRenderSize = function () {
    return {
      width: this.baseWidth * this.scale,
      height: this.baseHeight * this.scale,
    };
  };

  Comparison.prototype.clampTranslate = function () {
    var size = this.getRenderSize();

    if (this.scale <= 1) {
      this.translateX = 0;
      this.translateY = 0;
      return;
    }

    var minX = this.baseWidth - size.width;
    var minY = this.baseHeight - size.height;

    this.translateX = clamp(this.translateX, minX, 0);
    this.translateY = clamp(this.translateY, minY, 0);
  };

  Comparison.prototype.updateClip = function () {
    var size = this.getRenderSize();
    var beforeWidth = (this.position / 100) * this.baseWidth - this.translateX;
    var clipRight = size.width - beforeWidth;

    clipRight = clamp(clipRight, 0, size.width);
    this.beforeWrap.style.clipPath = 'inset(0 ' + clipRight + 'px 0 0)';
  };

  Comparison.prototype.setPosition = function (percent) {
    this.position = clamp(percent, 0, 100);
    this.divider.style.left = this.position + '%';
    this.handle.style.left = this.position + '%';
    this.handle.setAttribute(
      'aria-valuenow',
      String(Math.round(this.position)),
    );
    this.updateClip();
  };

  Comparison.prototype.applyTransform = function () {
    var size = this.getRenderSize();

    this.clampTranslate();

    this.stage.style.width = size.width + 'px';
    this.stage.style.height = size.height + 'px';
    this.stage.style.transform =
      'translate(' + this.translateX + 'px, ' + this.translateY + 'px)';

    this.updateClip();
  };

  Comparison.prototype.resetView = function () {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.applyTransform();
  };

  Comparison.prototype.getViewportPoint = function (event) {
    var rect = this.viewport.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  Comparison.prototype.positionFromClientX = function (clientX) {
    var rect = this.viewport.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  };

  Comparison.prototype.onPointerDown = function (event) {
    if (event.button !== 0) {
      return;
    }

    if (event.target === this.fullscreenBtn) {
      return;
    }

    var isHandle =
      event.target === this.handle || this.handle.contains(event.target);

    if (isHandle) {
      this.dragMode = 'divider';
      this.handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.scale > 1) {
      this.dragMode = 'pan';
      this.dragStart = {
        x: event.clientX,
        y: event.clientY,
        translateX: this.translateX,
        translateY: this.translateY,
      };
      this.viewport.classList.add('is-dragging');
      this.viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  };

  Comparison.prototype.onPointerMove = function (event) {
    if (!this.dragMode) {
      return;
    }

    if (this.dragMode === 'divider') {
      this.setPosition(this.positionFromClientX(event.clientX));
      return;
    }

    if (this.dragMode === 'pan' && this.dragStart) {
      this.translateX =
        this.dragStart.translateX + (event.clientX - this.dragStart.x);
      this.translateY =
        this.dragStart.translateY + (event.clientY - this.dragStart.y);
      this.applyTransform();

      this.dragStart.x = event.clientX;
      this.dragStart.y = event.clientY;
      this.dragStart.translateX = this.translateX;
      this.dragStart.translateY = this.translateY;
    }
  };

  Comparison.prototype.onPointerUp = function () {
    this.dragMode = null;
    this.dragStart = null;
    this.viewport.classList.remove('is-dragging');
  };

  Comparison.prototype.onWheel = function (event) {
    event.preventDefault();

    var point = this.getViewportPoint(event);
    var oldScale = this.scale;
    var direction = event.deltaY < 0 ? 1 : -1;
    var nextScale = clamp(
      oldScale + direction * WHEEL_STEP,
      MIN_SCALE,
      this.getMaxScale(),
    );

    if (nextScale === oldScale) {
      return;
    }

    var ratio = nextScale / oldScale;
    this.translateX = point.x - ratio * (point.x - this.translateX);
    this.translateY = point.y - ratio * (point.y - this.translateY);
    this.scale = nextScale;

    if (this.scale === 1) {
      this.translateX = 0;
      this.translateY = 0;
    }

    this.applyTransform();
  };

  Comparison.prototype.onDoubleClick = function (event) {
    if (event.target === this.handle || event.target === this.fullscreenBtn) {
      if (event.target === this.handle) {
        this.setPosition(50);
      }
      return;
    }

    this.resetView();
  };

  Comparison.prototype.onKeyDown = function (event) {
    var step = event.shiftKey ? 5 : 1;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setPosition(this.position - step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.setPosition(this.position + step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.setPosition(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.setPosition(100);
    }
  };

  Comparison.prototype.isFullscreen = function () {
    return document.fullscreenElement === this.viewport;
  };

  Comparison.prototype.onFullscreenClick = function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.isFullscreen()) {
      document.exitFullscreen();
      return;
    }

    this.viewport.requestFullscreen().catch(function () {});
  };

  Comparison.prototype.onFullscreenChange = function () {
    if (!this.fullscreenBtn) {
      return;
    }

    var active = this.isFullscreen();
    var icon = this.fullscreenBtn.querySelector('i');

    this.fullscreenBtn.classList.toggle('is-active', active);
    this.fullscreenBtn.setAttribute(
      'aria-label',
      active
        ? 'Exit fullscreen'
        : 'Enter fullscreen for ' + (this.root.dataset.scene || 'comparison'),
    );

    if (icon) {
      icon.className = active ? 'fas fa-compress' : 'fas fa-expand';
    }

    if (active) {
      this.viewport.style.height = '100%';
    } else {
      this.viewport.style.height = '';
    }

    this.updateBaseSize();
    this.applyTransform();
  };

  function initComparisons() {
    var nodes = document.querySelectorAll('.fl-comparison');

    nodes.forEach(function (node) {
      if (!node.dataset.flInitialized) {
        node.dataset.flInitialized = 'true';
        new Comparison(node);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComparisons);
  } else {
    initComparisons();
  }
})();
