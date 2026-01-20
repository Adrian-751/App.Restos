import { useState } from 'react';

/**
 * Hook personalizado para manejar modales
 * 
 * @returns {Object} { isOpen, editingItem, openModal, closeModal }
 * 
 * @example
 * const { isOpen, editingItem, openModal, closeModal } = useModal();
 * 
 * // Abrir modal para crear nuevo
 * openModal();
 * 
 * // Abrir modal para editar
 * openModal(item);
 */
export const useModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const openModal = (item = null) => {
        setEditingItem(item);
        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
        setEditingItem(null);
    };

    return { isOpen, editingItem, openModal, closeModal };
};

export default useModal;

