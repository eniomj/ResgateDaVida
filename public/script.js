function showModal(card) {
    const modal = document.getElementById("modal");
    const cardContent = card.innerHTML;
    const modalBody = modal.querySelector('.modal-body');
    modalBody.innerHTML = cardContent;

    const cardDescription = modalBody.querySelector('.card-description-text');
    const modalTable = modalBody.querySelector('.modal-taxonomy-table');
    const modalConservation = modalBody.querySelector('.modal-conservation');

    cardDescription.style.display = 'block';
    modalTable.style.display = 'block'
    modalConservation.style.display = 'block'
    modal.style.display = "block";

    const images = modalBody.querySelectorAll('img');
    images.forEach(img => img.classList.add('modal-img'));
    closeSidebar();
}

function closeModal() {
    const modal = document.getElementById("modal");
    modal.style.display = "none";
    closeSidebar();
}

window.onclick = function(event) {
    const modal = document.getElementById("modal");
    if (event.target == modal) {
        modal.style.display = "none";
        closeSidebar();
    }
}
