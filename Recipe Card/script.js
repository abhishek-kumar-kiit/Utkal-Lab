 let recipes = [];
let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

const recipeList = document.getElementById("recipe-list");
const searchInput = document.getElementById("search");
const modal = document.getElementById("recipe-modal");
const closeModal = document.getElementById("close-modal");
let currentFilter = "all";

// ===== Fetch recipes from JSON file =====
fetch("recipes.json")
    .then(res => res.json())
    .then(data => {
        recipes = data;
        renderRecipes(recipes);
    })
    .catch(err => console.error("Error loading recipes:", err));

// ===== Render Recipes =====
function renderRecipes(list) {
    recipeList.innerHTML = "";
    recipeList.classList.remove("fade-in"); 
    void recipeList.offsetWidth; 
    recipeList.classList.add("fade-in"); 

    if (list.length === 0) {
        recipeList.innerHTML = `<p style="text-align:center;font-size:18px;">No recipes found.</p>`;
        return;
    }

    list.forEach(recipe => {
        const card = document.createElement("div");
        card.classList.add("card");

        card.innerHTML = `
            <img src="${recipe.image}" alt="${recipe.name}">
            <div class="card-content">
                <h3>${recipe.name}
                    <span class="favorite ${favorites.includes(recipe.id) ? 'active' : ''}" 
                          onclick="toggleFavorite(${recipe.id}, event)">♥</span>
                </h3>
                ${recipe.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}
            </div>
        `;

        card.addEventListener("click", (e) => {
            if (!e.target.classList.contains("favorite")) {
                openModal(recipe);
            }
        });

        recipeList.appendChild(card);
    });
}

// ===== Open Modal =====
function openModal(recipe) {
    document.getElementById("modal-title").textContent = recipe.name;
    document.getElementById("modal-image").src = recipe.image;
    document.getElementById("modal-ingredients").innerHTML = recipe.ingredients.map(i => `<li>${i}</li>`).join("");
    document.getElementById("modal-steps").innerHTML = recipe.steps.map(s => `<li>${s}</li>`).join("");
    modal.style.display = "block";
}

closeModal.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };

// ===== Toggle Favorites =====
function toggleFavorite(id, event) {
    event.stopPropagation(); // prevent modal from opening
    if (favorites.includes(id)) {
        favorites = favorites.filter(fav => fav !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem("favorites", JSON.stringify(favorites));
    applyFilters();
}

// ===== Apply Search & Filter =====
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    let filtered = recipes.filter(r => r.name.toLowerCase().includes(searchTerm));

    if (currentFilter !== "all") {
        if (currentFilter === "favorites") {
            filtered = filtered.filter(r => favorites.includes(r.id));
        } else {
            filtered = filtered.filter(r => r.tags.includes(currentFilter));
        }
    }

    renderRecipes(filtered);
}

searchInput.addEventListener("input", applyFilters);

// ===== Nav Links Filter =====
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        currentFilter = link.getAttribute('data-filter');
        applyFilters();

        // Highlight active link
        document.querySelectorAll('.nav-links a').forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');
    });
});
