fetch('gallery-manifest.json')
  .then(res => res.json())
  .then(images => {
    const grid = document.getElementById('gallery-grid');

    // 1. Get references to modal elements
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeBtn = document.querySelector('.close-btn');
    const downloadLink = document.getElementById('download-link');
    
    // --- Helper Functions ---
    
    function openModal(imageSrc) {
        modalImage.src = imageSrc;
        downloadLink.href = imageSrc;
        modal.classList.remove('hidden');
    }

    function closeModal() {
        modal.classList.add('hidden');
        modalImage.src = '';
    }

    // --- Event Listeners for Modal Closing ---
    
    // Close when clicking the 'X' button
    closeBtn.addEventListener('click', closeModal);
    
    // Close when clicking the modal backdrop (the black area)
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'image-modal') {
            closeModal();
        }
    });
    
    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // --- Image Creation Loop ---
    images.forEach(file => {
      const fullPath = `gallery/${file}`;
      const img = document.createElement('img');
      img.src = fullPath;
      img.loading = "lazy";
      
      // Attach the click handler to the image
      img.addEventListener('click', () => {
        openModal(fullPath); 
      });

      grid.appendChild(img);
    });
  });
