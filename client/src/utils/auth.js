// Guardar token en localStorage
export const saveToken = (token) => {
    if (token) localStorage.setItem('token', token);
};

// Obtener token de localStorage
export const getToken = () => {
    return localStorage.getItem('token');
};

// Eliminar token
export const removeToken = () => {
    localStorage.removeItem('token');
};

// Guardar usuario (opcional)
export const saveUser = (user) => {
    if (!user) return;
    localStorage.setItem('user', JSON.stringify(user));
};

export const getUser = () => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};