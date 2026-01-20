import { useState, useEffect } from 'react';

/**
 * Hook personalizado para manejar operaciones asíncronas
 * 
 * @param {Function} asyncFunction - Función asíncrona a ejecutar
 * @param {Array} dependencies - Dependencias para el useEffect
 * @returns {Object} { data, loading, error, refetch }
 * 
 * @example
 * const { data, loading, error, refetch } = useAsync(
 *   () => api.get('/mesas').then(res => res.data),
 *   []
 * );
 */
export const useAsync = (asyncFunction, dependencies = []) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const execute = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await asyncFunction();
            setData(result);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);

    // Función para volver a ejecutar manualmente
    const refetch = () => {
        execute();
    };

    return { data, loading, error, refetch };
};

export default useAsync;

