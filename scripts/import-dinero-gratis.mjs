import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { config } from 'dotenv';

config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Obtener todos los leads de tipo AGENDA de la DB
  const [agendas] = await conn.execute(
    'SELECT correo, telefono, nombre FROM leads WHERE categoria = "AGENDA"'
  );

  // Crear sets normalizados para matching
  const correoSet = new Set();
  const telefonoSet = new Set();
  for (const a of agendas) {
    if (a.correo) correoSet.add(a.correo.trim().toLowerCase());
    if (a.telefono) {
      const tel = a.telefono.trim().replace(/[\s\-\(\)]/g, '');
      telefonoSet.add(tel);
    }
  }
  console.log(`Agendas en DB: ${agendas.length} (${correoSet.size} correos, ${telefonoSet.size} teléfonos)`);

  // 2. Leer el CSV
  const csvContent = readFileSync('/home/ubuntu/upload/SurveySubmission(2).csv', 'utf-8');
  const rows = parse(csvContent, { columns: true, skip_empty_lines: true });
  console.log(`Total registros en CSV: ${rows.length}`);

  // 3. Filtrar calificados (inversión >= 500 o tienen dinero/crédito)
  const INV_FIELD = '¿Cuál es tu capacidad actual de inversión en tu negocio?';
  const SIT_FIELD = '¿Cuál de estas describe tu situación financiera? * *';

  const calificados = rows.filter(r => {
    const inv = (r[INV_FIELD] || '').trim();
    const sit = (r[SIT_FIELD] || '').trim();
    // Tienen dinero/crédito (campo inversión vacío pero situación = "Sí - ACTUALMENTE tengo el dinero...")
    if (sit.includes('Sí - ACTUALMENTE tengo el dinero')) return true;
    // Entre 500-1000 o Entre 1000-1800
    if (inv.includes('Entre 500') || inv.includes('Entre 1.000')) return true;
    return false;
  });
  console.log(`Calificados por inversión: ${calificados.length}`);

  // 4. Excluir los que ya tienen agenda (cruce por correo o teléfono)
  const sinAgenda = calificados.filter(r => {
    const correo = (r['Mi mejor correo electronico es..'] || '').trim().toLowerCase();
    const tel = (r['Mi Numero de WhastsApp es'] || '').trim().replace(/[\s\-\(\)]/g, '');
    const tieneAgenda = correoSet.has(correo) || telefonoSet.has(tel);
    return !tieneAgenda;
  });
  console.log(`Sin agenda (a importar): ${sinAgenda.length}`);

  // Mostrar los que SÍ tienen agenda (para verificación)
  const conAgenda = calificados.filter(r => {
    const correo = (r['Mi mejor correo electronico es..'] || '').trim().toLowerCase();
    const tel = (r['Mi Numero de WhastsApp es'] || '').trim().replace(/[\s\-\(\)]/g, '');
    return correoSet.has(correo) || telefonoSet.has(tel);
  });
  console.log(`\nCalificados que YA tienen agenda (excluidos):`);
  for (const r of conAgenda) {
    console.log(`  - ${r['Mi Nombre Completo es..'].trim()} | ${r['Mi mejor correo electronico es..'].trim()}`);
  }

  // 5. Insertar los leads sin agenda como categoría LEAD en la DB
  console.log(`\nInsertando ${sinAgenda.length} leads en Dinero Gratis...`);

  // Parsear fecha del CSV: "Feb 17th 2026, 5:57 am" → timestamp
  function parseCSVDate(dateStr) {
    if (!dateStr) return new Date();
    // Formato: "Mar 5th 2026, 5:57 am"
    const clean = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
    const d = new Date(clean);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // Mapear origen desde UTM source
  function mapOrigen(row) {
    const src = (row['UTM Source'] || row['Fuente UTM'] || '').toLowerCase();
    if (src.includes('fb') || src.includes('facebook')) return 'ADS';
    if (src.includes('ig') || src.includes('instagram')) return 'ADS';
    if (src.includes('google')) return 'ADS';
    const fuente = (row['Fuente'] || '').toLowerCase();
    if (fuente.includes('direct')) return 'ORGANICO';
    return 'ADS';
  }

  // Mapear nivel de inversión para el score de facturación
  function mapFacturacion(row) {
    const inv = (row[INV_FIELD] || '').trim();
    const sit = (row[SIT_FIELD] || '').trim();
    if (sit.includes('Sí - ACTUALMENTE tengo el dinero')) return 'Tiene crédito/dinero';
    if (inv.includes('Entre 1.000')) return 'Entre 1.000-1.800 USD';
    if (inv.includes('Entre 500')) return 'Entre 500-1.000 USD';
    return inv;
  }

  let insertados = 0;
  let duplicados = 0;

  for (const r of sinAgenda) {
    const nombre = (r['Mi Nombre Completo es..'] || '').trim();
    const correo = (r['Mi mejor correo electronico es..'] || '').trim();
    const telefono = (r['Mi Numero de WhastsApp es'] || '').trim();
    const fechaEnvio = parseCSVDate(r['Fecha de envío']);
    const origen = mapOrigen(r);
    const facturacion = mapFacturacion(r);

    // Verificar si ya existe como LEAD (evitar duplicados)
    const [existing] = await conn.execute(
      'SELECT id FROM leads WHERE (correo = ? OR telefono = ?) AND categoria = "LEAD"',
      [correo, telefono]
    );

    if (existing.length > 0) {
      console.log(`  [SKIP] Ya existe como LEAD: ${nombre} | ${correo}`);
      duplicados++;
      continue;
    }

    // Insertar como LEAD (Dinero Gratis)
    await conn.execute(
      `INSERT INTO leads (
        nombre, correo, telefono, fecha, origen, categoria, estadoLead,
        facturado, notas, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'LEAD', 'NUEVO', ?, ?, ?, ?)`,
      [
        nombre,
        correo || null,
        telefono || null,
        fechaEnvio,
        origen,
        facturacion,
        `Encuesta: ${r[SIT_FIELD] || ''} | Inversión: ${r[INV_FIELD] || ''}`.substring(0, 500),
        fechaEnvio,
        fechaEnvio,
      ]
    );
    insertados++;
    console.log(`  [OK] ${nombre} | ${correo} | ${facturacion}`);
  }

  console.log(`\n✅ Importación completada:`);
  console.log(`   Insertados: ${insertados}`);
  console.log(`   Duplicados omitidos: ${duplicados}`);
  console.log(`   Total calificados sin agenda: ${sinAgenda.length}`);

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
