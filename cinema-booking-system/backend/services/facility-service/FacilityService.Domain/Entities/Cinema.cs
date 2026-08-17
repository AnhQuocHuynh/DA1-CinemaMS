using System.Collections.Generic;
using System;

namespace FacilityService.Domain.Entities
{
    public class Cinema
    {
        public long Id { get; private set; }
        public string Name { get; private set; }
        public string Address { get; private set; }
        public string? City { get; private set; }
        public string? Phone { get; private set; }
        public bool Active { get; private set; } = true;

        private Cinema() 
        {
            Name = null!;
            Address = null!;
        } //EF core

        public Cinema(string name, string address, string? city, string? phone)
        {
            if(string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Name is required", nameof(name));
            }
            if(string.IsNullOrWhiteSpace(address))
            {
                throw new ArgumentException("Address is required", nameof(address));
            }

            Name = name;
            Address = address;
            City = city;
            Phone = phone;
            Active = true;
        }

        public void Disable()
        {
            Active = false;
        }

        public void Enable()
        {
            Active = true;
        }

        public void Update(string name, string address, string? city, string? phone)
        {
            if(string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Name is required", nameof(name));
            }
            if(string.IsNullOrWhiteSpace(address))
            {
                throw new ArgumentException("Address is required", nameof(address));
            }
            Name = name;
            Address = address;
            City = city;
            Phone = phone;
        }

        public ICollection<Room> Rooms { get; set; } = new List<Room>();
    }
}
