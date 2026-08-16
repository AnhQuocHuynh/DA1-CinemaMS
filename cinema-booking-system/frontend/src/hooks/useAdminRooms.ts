import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminTheater } from '../types/admin';

export const useAdminRooms = () => {
  const [theaters, setTheaters] = useState<AdminTheater[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getTheaters();
      setTheaters(data);
    } catch (error) {
      console.error('Failed to load theater data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const addTheater = async (data: any) => {
    await adminService.createTheater(data);
    await loadRooms();
  };

  const updateTheater = async (id: number | string, data: any) => {
    await adminService.updateTheater(id, data);
    await loadRooms();
  };

  const deleteTheater = async (id: number | string) => {
    await adminService.deleteTheater(id);
    await loadRooms();
  };

  const addRoom = async (cinemaId: number | string, data: any) => {
    try {
      await adminService.createRoom(cinemaId, { ...data, cinemaId: Number(cinemaId) });
    } catch (e) {
      console.error('Failed to create room:', e);
      throw e;
    }
    await loadRooms();
  };

  const updateRoom = async (cinemaId: number | string, roomId: number | string, data: any) => {
    try {
      await adminService.updateRoom(cinemaId, roomId, { ...data, id: Number(roomId), cinemaId: Number(cinemaId) });
    } catch (e) {
      console.error('Failed to update room:', e);
      throw e;
    }
    await loadRooms();
  };

  const deleteRoom = async (cinemaId: number | string, roomId: number | string) => {
    await adminService.deleteRoom(cinemaId, roomId);
    await loadRooms();
  };

  return {
    theaters,
    isLoading,
    refetchTheaters: loadRooms,
    addTheater,
    updateTheater,
    deleteTheater,
    addRoom,
    updateRoom,
    deleteRoom,
  };
};
