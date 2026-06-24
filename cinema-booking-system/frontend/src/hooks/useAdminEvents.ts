import { useState, useEffect } from 'react';
import { eventService, EventResponse } from '../services/eventService';

export const useAdminEvents = () => {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await eventService.getAllEvents();
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const addEvent = async (data: any) => {
    try {
      await eventService.createEvent(data);
      await fetchEvents();
    } catch (error) {
      console.error('Failed to add event:', error);
    }
  };

  const deleteEvent = async (id: number) => {
    try {
      await eventService.deleteEvent(id);
      await fetchEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  return { events, isLoading, addEvent, deleteEvent, refresh: fetchEvents };
};
