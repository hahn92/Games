/* main.js — Catalog filter, search and pagination with shareable URLs */
(function () {
    var GAMES_PER_PAGE = 8;
    var currentPage    = 1;
    var activeCategory = 'Todos';
    var searchQuery    = '';

    /* ── Read state from URL query params ─────────────────────────── */
    function getParam(name) {
        var match = window.location.search.match(
            new RegExp('[?&]' + name + '=([^&]*)')
        );
        return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
    }

    function readURL() {
        activeCategory = getParam('cat') || 'Todos';
        searchQuery    = getParam('q')   || '';
        currentPage    = parseInt(getParam('p'), 10) || 1;
    }

    /* ── Push current state to URL without page reload ─────────────── */
    function syncURL() {
        var parts = [];
        if (activeCategory !== 'Todos') parts.push('cat=' + encodeURIComponent(activeCategory));
        if (searchQuery)                parts.push('q='   + encodeURIComponent(searchQuery));
        if (currentPage > 1)           parts.push('p='   + currentPage);
        var qs  = parts.length ? '?' + parts.join('&') : '';
        var url = window.location.pathname + qs;
        if (history.replaceState) history.replaceState(null, '', url);
    }

    /* ── Init state from URL ── */
    readURL();

    var allCards = Array.from(document.querySelectorAll('.game-card'));

    /* ── Assign data-category from the visible text ── */
    allCards.forEach(function (card) {
        var catEl = card.querySelector('.game-category');
        if (catEl) card.dataset.category = catEl.textContent.trim();
    });

    /* ── Build sorted category list ── */
    var catSet = {};
    allCards.forEach(function (card) { catSet[card.dataset.category] = true; });
    var categories = ['Todos'].concat(Object.keys(catSet).sort());

    /* ── Controls: se rellena el hueco que ya está en el HTML ──
     *
     * El contenedor NO se crea aquí. Creándolo e insertándolo antes de <main>
     * aparecía después del primer pintado y empujaba el catálogo hacia abajo:
     * la mitad del salto de diseño que medía Lighthouse. Ahora el hueco existe
     * desde el HTML, con su altura reservada por CSS, y esto sólo lo llena. */
    var main = document.querySelector('main');
    var controlsDiv = document.getElementById('catalogControls');
    if (!controlsDiv) {           /* por si alguien reutiliza main.js sin el hueco */
        controlsDiv = document.createElement('div');
        controlsDiv.className = 'catalog-controls';
        main.parentNode.insertBefore(controlsDiv, main);
    }
    controlsDiv.innerHTML =
        '<div class="controls-top">' +
            '<input type="search" class="search-input" id="catalogSearch" placeholder="Buscar juego..." aria-label="Buscar juego por nombre" autocomplete="off">' +
            '<span class="results-count" id="resultsCount"></span>' +
        '</div>' +
        '<div class="filter-btns" id="filterBtns"></div>';

    /* ── Inject pagination HTML after the grid ── */
    var paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';
    paginationDiv.id = 'pagination';
    paginationDiv.style.display = 'none';
    paginationDiv.innerHTML =
        '<button class="page-btn" id="prevBtn">← Anterior</button>' +
        '<span class="page-info" id="pageInfo"></span>' +
        '<button class="page-btn" id="nextBtn">Siguiente →</button>';
    main.appendChild(paginationDiv);

    /* ── Build filter buttons (mark active from URL state) ── */
    var filterBtnsEl = document.getElementById('filterBtns');
    categories.forEach(function (cat) {
        var btn = document.createElement('button');
        btn.className = 'filter-btn' + (cat === activeCategory ? ' active' : '');
        btn.textContent = cat;
        btn.addEventListener('click', function () {
            activeCategory = cat;
            currentPage = 1;
            document.querySelectorAll('.filter-btn').forEach(function (b) {
                b.classList.toggle('active', b === btn);
            });
            applyFilters();
        });
        filterBtnsEl.appendChild(btn);
    });

    /* ── Search input — restore value from URL ── */
    var searchEl = document.getElementById('catalogSearch');
    searchEl.value = searchQuery;
    searchEl.addEventListener('input', function () {
        searchQuery = this.value.trim().toLowerCase();
        currentPage = 1;
        applyFilters();
    });

    /* ── Pagination buttons ── */
    document.getElementById('prevBtn').addEventListener('click', function () {
        if (currentPage > 1) { currentPage--; applyFilters(); scrollToGrid(); }
    });
    document.getElementById('nextBtn').addEventListener('click', function () {
        currentPage++; applyFilters(); scrollToGrid();
    });

    function scrollToGrid() {
        var grid = document.querySelector('.games-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ── Core filter + paginate + URL sync ── */
    function applyFilters() {
        var filtered = allCards.filter(function (card) {
            var matchCat = activeCategory === 'Todos' || card.dataset.category === activeCategory;
            var title    = (card.querySelector('.game-title') || {}).textContent || '';
            var matchQ   = !searchQuery || title.toLowerCase().includes(searchQuery);
            return matchCat && matchQ;
        });

        var total      = filtered.length;
        var totalPages = Math.max(1, Math.ceil(total / GAMES_PER_PAGE));
        if (currentPage > totalPages) currentPage = totalPages;

        var start = (currentPage - 1) * GAMES_PER_PAGE;
        var end   = start + GAMES_PER_PAGE;

        allCards.forEach(function (card) { card.style.display = 'none'; });
        filtered.slice(start, end).forEach(function (card) { card.style.display = ''; });

        /* no-results message */
        var noResults = document.getElementById('noResults');
        if (noResults) noResults.style.display = total === 0 ? 'block' : 'none';

        /* results count label */
        var countEl = document.getElementById('resultsCount');
        if (countEl) {
            countEl.textContent = total === allCards.length
                ? total + ' juegos'
                : total + ' de ' + allCards.length + ' juegos';
        }

        /* pagination controls */
        var pagination = document.getElementById('pagination');
        var pageInfo   = document.getElementById('pageInfo');
        var prevBtn    = document.getElementById('prevBtn');
        var nextBtn    = document.getElementById('nextBtn');

        pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        pageInfo.textContent = 'Página ' + currentPage + ' / ' + totalPages;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;

        /* sync URL so the current view is shareable */
        syncURL();
    }

    /* ── Init ── */
    applyFilters();
}());
