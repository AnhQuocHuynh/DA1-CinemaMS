using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FacilityService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial_Create : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cinemas",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Address = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cinemas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seat_types",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PriceMultiplier = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    DefaultColumnSpan = table.Column<int>(type: "integer", nullable: true, defaultValue: 1),
                    Description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seat_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rooms",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CinemaId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    TotalSeats = table.Column<int>(type: "integer", nullable: true),
                    Rows = table.Column<int>(type: "integer", nullable: true),
                    Columns = table.Column<int>(type: "integer", nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    UnderMaintenance = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rooms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rooms_cinemas_CinemaId",
                        column: x => x.CinemaId,
                        principalTable: "cinemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "seat_templates",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoomId = table.Column<long>(type: "bigint", nullable: false),
                    SeatTypeId = table.Column<long>(type: "bigint", nullable: true),
                    RowLabel = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    ColumnNumber = table.Column<int>(type: "integer", nullable: false),
                    ColumnSpan = table.Column<int>(type: "integer", nullable: true, defaultValue: 1),
                    Pathway = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seat_templates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_seat_templates_rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_seat_templates_seat_types_SeatTypeId",
                        column: x => x.SeatTypeId,
                        principalTable: "seat_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_rooms_CinemaId",
                table: "rooms",
                column: "CinemaId");

            migrationBuilder.CreateIndex(
                name: "IX_seat_templates_RoomId_RowLabel_ColumnNumber",
                table: "seat_templates",
                columns: new[] { "RoomId", "RowLabel", "ColumnNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seat_templates_SeatTypeId",
                table: "seat_templates",
                column: "SeatTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_seat_types_Code",
                table: "seat_types",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seat_types_Name",
                table: "seat_types",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seat_templates");

            migrationBuilder.DropTable(
                name: "rooms");

            migrationBuilder.DropTable(
                name: "seat_types");

            migrationBuilder.DropTable(
                name: "cinemas");
        }
    }
}
