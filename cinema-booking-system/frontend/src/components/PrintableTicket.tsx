import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TicketDetails } from '../types/booking';
import { formatVND } from '../utils/formatters';

interface Props {
  ticket: TicketDetails;
}

export const PrintableTicket: React.FC<Props> = ({ ticket }) => {
  return (
    <div className="w-[680px] bg-white rounded-xl shadow-lg flex font-sans text-left" style={{ color: '#1a1a1a' }}>
      {/* Left section */}
      <div className="flex-1 px-6 py-7">
        <div className="text-[13px] font-bold text-[#e50914] uppercase tracking-widest">
          Cinema Booking System
        </div>
        <div className="text-[22px] font-bold text-[#1a1a1a] mt-2 mb-4 leading-snug">
          {ticket.movieTitle || 'Vé Xem Phim'}
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-5 mb-5">
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-[2px]">Ngày chiếu</label>
            <span className="text-[14px] font-semibold text-[#333]">{ticket.date || '—'}</span>
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-[2px]">Giờ chiếu</label>
            <span className="text-[14px] font-semibold text-[#333]">{ticket.time || '—'}</span>
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-[2px]">Rạp</label>
            <span className="text-[14px] font-semibold text-[#333]">{ticket.cinemaName || '—'}</span>
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-[2px]">Phòng</label>
            <span className="text-[14px] font-semibold text-[#333]">{ticket.hallName || '—'}</span>
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-[2px]">Loại ghế</label>
            <span className="text-[14px] font-semibold text-[#333]">{ticket.seatTypeName || '—'}</span>
          </div>
        </div>

        <div className="inline-block bg-[#e50914] text-white text-[18px] font-bold py-2 px-5 rounded-lg mb-4">
          Ghế {ticket.seatLabel || ticket.seats.join(', ')}
        </div>

        <div className="text-[11px] text-[#aaa] tracking-wider">
          Mã vé: <span className="text-[#555] font-bold">{ticket.ticketCode}</span>
        </div>
      </div>

      {/* Tear line */}
      <div className="relative w-[2px] bg-[repeating-linear-gradient(to_bottom,#ddd_0,#ddd_8px,transparent_8px,transparent_16px)]">
        {/* Hole punches matching the white PDF background */}
        <div className="absolute -left-[10px] -top-[10px] w-5 h-5 bg-white rounded-full"></div>
        <div className="absolute -left-[10px] -bottom-[10px] w-5 h-5 bg-white rounded-full"></div>
      </div>

      {/* Right section */}
      <div className="w-[180px] bg-[#1a1a1a] flex flex-col items-center justify-center py-6 px-4 gap-4">
        <div className="text-[10px] text-[#888] uppercase tracking-wider text-center">
          Quét mã để vào cổng
        </div>
        
        {ticket.qrCodeData ? (
          <div className="w-[120px] h-[120px] bg-white rounded-lg flex items-center justify-center p-2">
            <QRCodeSVG value={ticket.qrCodeData} size={104} level="H" />
          </div>
        ) : (
          <div className="w-[120px] h-[120px] bg-white rounded-lg flex items-center justify-center text-[10px] text-[#999] text-center p-2">
            QR Code<br />{ticket.ticketCode}
          </div>
        )}

        <div className="text-[10px] text-[#888] uppercase tracking-wider text-center mt-2">
          Giá vé
        </div>
        <div className="text-[18px] font-bold text-white">
          {formatVND(ticket.price)}
        </div>
      </div>
    </div>
  );
};
