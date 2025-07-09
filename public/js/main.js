$(document).ready(function () {
  let sessionId = null;

  $('#uploadForm').on('submit', function (e) {
    e.preventDefault();
    const formData = new FormData(this);

    $('#progressBox').removeClass('d-none');
    $('#downloadContainer').addClass('d-none');
    $('#videoGrid, #videoSlider').empty();

    $.ajax({
      url: '/api/cut',
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: (data) => {
        sessionId = data.id;
        $('#progressBox .progress-bar').text('Selesai! Memuat hasil...');
        setTimeout(() => {
          $('#progressBox').addClass('d-none');
          $('#uploadForm').addClass('d-none');
          loadVideos(sessionId);
        }, 2000);
      },
      error: () => {
        $('#progressBox .progress-bar').text('Gagal memproses!');
      }
    });
  });

  function loadVideos(id) {
    $.getJSON(`/api/videos/${id}`, function (files) {
      if (!files.length) return;

      $('#downloadContainer').removeClass('d-none');
      $('#downloadContainer a').attr('href', `/api/download-all/${id}`);

      files.forEach((url, i) => {
        const videoHTML = `
          <video class="w-100 mb-2" controls src="${url}"></video>
          <div class="d-grid gap-2">
            <a href="${url}" download class="btn btn-outline-secondary btn-sm">
              <i class="fa fa-download"></i> Download Part ${i + 1}
            </a>
          </div>
        `;
        $('#videoGrid').append(`<div class="col-md-4 mb-4">${videoHTML}</div>`).removeClass('d-none');
        $('#videoSlider').append(`<div style="min-width: 250px">${videoHTML}</div>`).removeClass('d-none');
      });
    });
  }
});
