fetch('gallery-manifest.json')
  .then(res => res.json())
  .then(images => {
    const grid = document.getElementById('gallery-grid');

    images.forEach(file => {
      const img = document.createElement('img');
      img.src = `gallery/${file}`;
      grid.appendChild(img);
    });
  });
