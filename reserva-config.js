/*
 * Configuración del formulario de reservas y de reseñas — AM Luxury Beauty Studio
 *
 * Este archivo va en la MISMA carpeta que index.html.
 * Aquí guardas tus datos propios; así no se pierden cuando se actualiza el index.html.
 */
window.AM_RESERVA = {
  // URL del Google Apps Script de CITAS (termina en /exec).
  // Mientras esté vacía NO aparece el botón "Enviar desde esta página".
  endpoint: 'https://script.google.com/macros/s/AKfycbzOea2IoOqmi7wB605fZsVHZ3rHGV0vfPqvVYmsKRd64pbnmozFJ1WbBqn3Kyq5dEMe/exec',

  // URL del Google Apps Script de RESEÑAS (otro proyecto distinto; termina en /exec).
  // Mientras esté vacía NO aparece el botón "Añadir reseña" ni se cargan reseñas de la hoja.
  resenasEndpoint: 'https://script.google.com/macros/s/AKfycbyGBuNotmCYpObH4if15ejUo_UczTjFdN9lPa6KhyH4gdCoN9a88f0pmrmA81g33cG4/exec',

  // Correo donde quieres recibir las solicitudes (provisional; cámbialo por el del studio).
  // Si lo dejas vacío, desaparecen las opciones de correo del formulario.
  email: 'amluxury.beautystudio@gmail.com'
};
