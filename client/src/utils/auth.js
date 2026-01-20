// Guardar token en localStorage
export const saveToken = (token) => {
    localStorage.setItem('token', token);
};

// Obtener token de localStorage
export const getToken = () => {
    return localStorage.getItem('token');
};

// Eliminar token
export const removeToken = () => {
    localStorage.removeItem('token');
};