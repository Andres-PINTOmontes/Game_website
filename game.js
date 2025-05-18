// game.js - Lógica completa del juego integrada con HTML profesional
let ronda = 0;


// --- Clases y Estado del Juego ---
class Empresa {
  constructor() {
    this.margenGanancia = 0.30; // antes margenGanancias
    this.costoProduccion = 5000;
    this.gastosOperacionales = 2000; // antes gastoOperacional
    this.ingresoNeto = 100000; // antes ingresosNetos
    // this.balance = 100000; // eliminado
    this.bonificacionVentas = 1.0;
    this.rondasBonificacion = 0;
    this.limiteBonificaciones = 0;
  }
  calcularIngresoBase(casillas) {
    return 10000 * casillas;
  }
  actualizarIngresos(cantidad, tramoIVA = 0) {
    let ingreso = tramoIVA > 0 ? cantidad * (1 - tramoIVA/100) : cantidad;
    if (this.rondasBonificacion > 0 && this.limiteBonificaciones <= 0) ingreso *= this.bonificacionVentas;
    this.ingresoNeto += ingreso;
    // this.balance += ingreso; // eliminado
    if (this.rondasBonificacion > 0) {
      this.rondasBonificacion--;
      if (this.rondasBonificacion === 0) this.bonificacionVentas = 1.0;
    }
    if (this.limiteBonificaciones > 0) this.limiteBonificaciones--;
    return ingreso;
  }
  pagarGastos(cantidad) {
    // this.balance -= cantidad; // eliminado
    this.ingresoNeto -= cantidad;
    return this.ingresoNeto >= 0;
  }
  estado() {
    let texto =
      `Margen de ganancia: ${(this.margenGanancia*100).toFixed(2)}%\n` +
      `Costo de producción: $${this.costoProduccion}\n` +
      `Gastos operacionales: $${this.gastosOperacionales}\n` +
      `Ingreso neto: $${this.ingresoNeto}\n`;
    if (this.rondasBonificacion>0) texto += `Bonificación ventas: +${((this.bonificacionVentas-1)*100).toFixed(0)}% x${this.rondasBonificacion} rondas\n`;
    if (this.limiteBonificaciones>0) texto += `Bonificaciones limitadas: ${this.limiteBonificaciones} rondas\n`;
    return texto;
  }
}

class Jugador {
  constructor(nombre) {
    this.nombre = nombre;
    this.empresa = new Empresa();
    this.casilla = 0; // antes posicion
    this.ultimoDado = 0; // antes lastRoll
    this.turnosPerdidos = 0;
    this.segurosRestantes = 0;
    this.ultimoIngreso = 0;
  }
  mostrarEstado() {
    let estado = `Casilla ${this.casilla} (IVA: ${getTramoIVA(this.casilla)}%)\n` + this.empresa.estado();
    if (this.turnosPerdidos>0) estado += `Turnos perdidos: ${this.turnosPerdidos}\n`;
    if (this.segurosRestantes>0) estado += `Seguros: ${this.segurosRestantes}\n`;
    return estado;
  }
}

// --- Tablero ---
function crearTablero() {
  const t = {};
  for (let i=0; i<64; i++) {
    t[i] = { icon: '⬜', tipo: 'normal', indiceEfecto: null };
  }
  const esquinas = {0:'💥',16:'💰',32:'💎',48:'🚀'};
  Object.keys(esquinas).forEach(i=> t[i] = { icon: esquinas[i], tipo:'especial', indiceEfecto:null });
  // Usa una imagen PNG para las oportunidades
  const opp=[1,4,7,10,13,17,20,23,26,29,33,36,39,42,45,49,52,55,58,61];
  opp.forEach((c,i)=> t[c]={icon:'<img src="assets/img/signopeso.png" alt="$" style="height:28px;width:auto;vertical-align:middle;">',tipo:'oportunidad',indiceEfecto:i});
  const threats=[3,6,9,12,15,19,22,25,28,31,35,38,41,44,47,51,54,57,60,63];
  threats.forEach((c,i)=> t[c]={icon:'⚠️',tipo:'amenaza',indiceEfecto:i});
  return t;
}
function getTramoIVA(c){if(c<=16)return 5;if(c<=32)return 10;if(c<=48)return 15;return 30;}
const tablero = crearTablero();
let jugador=null,gameOver=false,esperandoDecision=false,casillaActual=null;

// --- UI Helpers ---
function clearDialog(){document.getElementById('dialog-container').innerHTML='';}
function showOutput(html){document.getElementById('output').innerHTML=html;}

// --- Render Tablero y Dashboard ---
function actualizarTablero(){
  const bc=document.getElementById('board-container'); bc.innerHTML='';
  const start=Math.max(0,jugador?jugador.casilla-8:0),end=Math.min(63,start+15);
  const grid=document.createElement('div'); grid.className='board-grid';
  for(let i=start;i<=end;i++){
    let cell=tablero[i];
    const d=document.createElement('div'); d.className='board-space';
    if(jugador&&jugador.casilla===i)d.classList.add('active');
    // Oportunidades por lado del tablero
    if(cell.tipo==='oportunidad' && cell.indiceEfecto!==null){
      if(i>=0 && i<=15){
        d.classList.add('opp-early');   // #A1DAB4
      } else if(i>=16 && i<=31){
        d.classList.add('opp-mid1');    // #F6EB61
      } else if(i>=32 && i<=47){
        d.classList.add('opp-mid2');    // #FBB040
      } else if(i>=48 && i<=63){
        d.classList.add('opp-late');    // #FA6F64
      }
    }
    // Amenazas por lado del tablero
    if(cell.tipo==='amenaza' && cell.indiceEfecto!==null){
      if(i>=0 && i<=15){
        d.classList.add('threat-early');    // #007A33
      } else if(i>=16 && i<=31){
        d.classList.add('threat-mid1');     // #FFEF16
      } else if(i>=32 && i<=47){
        d.classList.add('threat-mid2');     // #FF6A13
      } else if(i>=48 && i<=63){
        d.classList.add('threat-late');     // #F40014
      }
    }
    d.innerHTML=`<div>${i}</div><div>${cell.icon}</div>`;
    grid.appendChild(d);
  }
  bc.appendChild(grid);
}
function actualizarEmpresaDashboard(){
  if(!jugador)return;
  const cm=document.getElementById('company-metrics');
  cm.innerHTML=jugador.empresa.estado().replace(/\n/g,'<br>');
}

// --- Inicio y Turno ---
function initJuego(){
  const nombre=document.getElementById('nombre').value.trim();
  if(!nombre){showOutput('❗ Ingresa nombre.');return;}
  jugador=new Jugador(nombre);gameOver=false;esperandoDecision=false;clearDialog();
  document.getElementById('juego').style.display='block';
  // Ocultar bienvenida y menú
  document.querySelector('.welcome-msg').style.display = 'none';
  document.getElementById('menu').style.display = 'none';
  showOutput(`🎮 Bienvenido ${nombre}!<br>`+jugador.mostrarEstado().replace(/\n/g,'<br>'));
  actualizarTablero();actualizarEmpresaDashboard();
}
function turno() {
  // 0) Incrementar y mostrar encabezado de ronda
  //ronda++;
  //showOutput(`--- Ronda ${ronda} ---`);

  // 1) Validaciones iniciales
  if (!jugador) {
    showOutput('Primero inicia juego.');
    return;
  }
  if (gameOver) {
    showOutput('Juego terminado.');
    return;
  }
  if (esperandoDecision) {
    return;
  }

  // 2) Turnos perdidos
  if (jugador.turnosPerdidos > 0) {
    jugador.turnosPerdidos--;
    showOutput(`Turnos perdidos: ${jugador.turnosPerdidos}`);
    return;
  }

  // 3) Leer y validar dado
  const v = parseInt(document.getElementById('dado').value);
  if (isNaN(v) || v < 1 || v > 6) {
    showOutput('❗ Dado 1-6');
    return;
  }

  // --- Validación de frontera: solo puedes ganar con el número exacto ---
  const prev = jugador.casilla;
  let np = prev + v;
  if (np > 64) {
    showOutput('Debes sacar el número exacto para llegar a la meta.');
    return;
  }
  if (np === 64) {
    gameOver = true;
  }
  clearDialog();
  const ingres = jugador.empresa.calcularIngresoBase(np - prev);
  const neto  = jugador.empresa.actualizarIngresos(ingres, getTramoIVA(np));
  jugador.ultimoIngreso = neto;
  jugador.casilla      = np;
  jugador.ultimoDado   = v;

  showOutput(`🎲 ${jugador.nombre} avanza a ${np}, gana $${neto.toFixed(0)}`);
  // 5) Actualizar UI
  actualizarTablero();
  actualizarEmpresaDashboard();
  // 6) Victoria
  if (np === 64) {
    showOutput('🏆 ¡Victoria!');
    return;
  }
  // 7) Procesar efecto de casilla
  setTimeout(() => {
    const cell = tablero[jugador.casilla];
    if      (cell.tipo === 'oportunidad') procesarCasillaOportunidad(cell);
    else if (cell.tipo === 'amenaza')      procesarCasillaAmenaza(cell);
    else                                   showOutput(jugador.mostrarEstado().replace(/\n/g,'<br>'));
  }, 300);
}

// --- Oportunidades con confirmación inline ---
function clearDialog() {
  document.getElementById('dialog-container').innerHTML = '';
}

// Llamar esta función al caer en una casilla de oportunidad
function procesarCasillaOportunidad(casilla) {
  const idx = casilla.indiceEfecto;
  efectosOpp[idx]();
}

// Array de funciones que muestran su propio diálogo y confirman antes de aplicar el efecto
const efectosOpp = [
  // 0: Casilla 1 - Tendencia Viral en Redes Sociales
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 1: Tendencia Viral en Redes Sociales</strong><br>
        <em>Un influencer menciona tu producto en redes sociales sin costo alguno, y esto genera un aumento explosivo de visibilidad.</em>
        <ul class="mt-2 mb-2">
          <li><b>Effecto:</b> Recibes ingresos normales y avanzas una casilla extra.</li>
          <li><b>Costos:</b> N.A</li>
        </ul>
        <div class="mt-3">
          <button id="ok-0" class="btn btn-success me-2">Tomar efecto</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-0').onclick = () => {
      clearDialog();
      jugador.casilla++;
      actualizarTablero();
      showOutput(
        `<strong>Tendencia Viral en Redes Sociales:</strong><br>
        Un influencer menciona tu producto en redes sociales sin costo alguno, y esto genera un aumento explosivo de visibilidad.<br>
        <b>¡Avanzas una casilla extra y recibes ingresos!</b>`
      );
      esperandoDecision = false;
    };
  },
  // 1: Casilla 4 - Tercerización en la distribución
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 4: Tercerización en la distribución</strong><br>
        <em>Una trasportadora te ofrece el servicio de distribución de tu producto a un precio más bajo.</em>
        <ul class="mt-2 mb-2">
          <li><b>Debes invertir:</b> $15,000</li>
          <li><b>Efecto:</b> Disminuye los gastos operacionales en un 5%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-1" class="btn btn-success me-2">Aceptar</button>
          <button id="no-1" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-1').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 15000) {
        jugador.empresa.pagarGastos(15000);
        jugador.empresa.gastosOperacionales = Math.floor(jugador.empresa.gastosOperacionales * 0.95);
        actualizarEmpresaDashboard();
        showOutput('<strong>Tercerización:</strong> Gastos operacionales disminuidos en un 5%.');
      } else {
        showOutput('<strong>Tercerización:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-1').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },

  // 2: Casilla 7 - Branding de la marca (ahora con más riesgo)
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 7: Branding de la marca</strong><br>
        <em>El posicionamiento de tu marca requiere que hagas una estrategia de branding. Para esto debes invertir $8,000.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Requiere invertir $8,000</li>
          <li><b>Efecto:</b> Recibes $12,000 por nueva visibilidad y puedes lanzar un dado: si sale 5 o 6, recibes $5,000 extra; si sale 1, pierdes $4,000 adicionales.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-2" class="btn btn-success me-2">Invertir</button>
          <button id="no-2" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-2').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 8000) {
        jugador.empresa.pagarGastos(8000);
        jugador.empresa.actualizarIngresos(12000);
        document.getElementById('dialog-container').innerHTML = `
          <div class="alert alert-info">
            Lanza un dado (1-6) para ver si obtienes un bonus o una penalización:<br>
            <input id="dado-bonus7" type="number" min="1" max="6" class="form-control w-auto d-inline-block" style="width:80px;display:inline-block;" placeholder="Dado">
            <button id="conf-bonus7" class="btn btn-primary mt-2">Confirmar</button>
          </div>`;
        document.getElementById('conf-bonus7').onclick = () => {
          const val = parseInt(document.getElementById('dado-bonus7').value);
          clearDialog();
          if (val === 5 || val === 6) {
            jugador.empresa.actualizarIngresos(5000);
            showOutput('<strong>Branding:</strong> Recibes $12,000 y un bonus de $5,000 por excelente visibilidad.');
          } else if (val === 1) {
            jugador.empresa.pagarGastos(4000);
            showOutput('<strong>Branding:</strong> Recibes $12,000 pero pierdes $4,000 por mala campaña.');
          } else {
            showOutput('<strong>Branding:</strong> Recibes $12,000 por nueva visibilidad.');
          }
          actualizarEmpresaDashboard();
          esperandoDecision = false;
        };
      } else {
        showOutput('<strong>Branding:</strong> Fondos insuficientes.');
        esperandoDecision = false;
      }
    };
    document.getElementById('no-2').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 3: Casilla 10 - Campaña de Marketing
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 10: Campaña de Marketing</strong><br>
        <em>Una de las mejores agencias de marketing te propone una campaña prometedora que aumentaría tu demanda.</em>
        <ul class="mt-2 mb-2">
          <li><b>Debes invertir:</b> $7,000</li>
          <li><b>Efecto:</b> Puedes lanzar dos veces y avanzar la suma de los dados</li>
        </ul>
        <div class="mt-3">
          <button id="ok-3" class="btn btn-success me-2">Aceptar</button>
          <button id="no-3" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-3').onclick = () => {
      if (jugador.empresa.ingresoNeto < 7000) {
        clearDialog();
        showOutput('<strong>Campaña:</strong> Fondos insuficientes.');
        esperandoDecision = false;
        return;
      }
      jugador.empresa.pagarGastos(7000);
      clearDialog();
      const dlg2 = `
        <div class="alert alert-info">
          Ingresa resultados de dos dados:<br>
          <input id="m1" type="number" min="1" max="6" placeholder="Dado 1"><br>
          <input id="m2" type="number" min="1" max="6" placeholder="Dado 2"><br>
          <button id="conf-3" class="btn btn-primary mt-2">Confirmar</button>
        </div>`;
      document.getElementById('dialog-container').innerHTML = dlg2;
      document.getElementById('conf-3').onclick = () => {
        const d1 = parseInt(document.getElementById('m1').value);
        const d2 = parseInt(document.getElementById('m2').value);
        if ([d1, d2].some(x => isNaN(x) || x < 1 || x > 6)) return alert('Dados 1-6');
        const suma = d1 + d2;
        jugador.casilla += suma;
        clearDialog();
        showOutput(`<strong>Campaña de Marketing:</strong> Avanzas ${suma} casillas (suma de los dados).`);
        actualizarTablero();
        actualizarEmpresaDashboard();
        esperandoDecision = false;
      };
    };
    document.getElementById('no-3').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 4: Casilla 13 - Concurso de emprendimiento
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 13: Concurso de emprendimiento</strong><br>
        <em>Al inscribirte en la competencia, el premio al proyecto ganador es una inversión en maquinaria para optimizar procesos.</em>
        <ul class="mt-2 mb-2">
          <li><b>Debes perder un turno</b> para la postulación en la competencia</li>
          <li><b>Efecto:</b> Disminuyes en un 15% tu costo de producción</li>
        </ul>
        <div class="mt-3">
          <button id="ok-4" class="btn btn-success me-2">Aceptar</button>
          <button id="no-4" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-4').onclick = () => {
      clearDialog();
      jugador.turnosPerdidos++;
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.85);
      actualizarEmpresaDashboard();
      showOutput('<strong>Concurso de emprendimiento:</strong> Pierdes un turno y disminuyes en un 15% tu costo de producción.');
      esperandoDecision = false;
    };
    document.getElementById('no-4').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 5: Casilla 17 - Desarrollo de nuevo producto/servicio
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 17: Desarrollo de nuevo producto/servicio</strong><br>
        <em>Tu equipo de innovación lanza un producto revolucionario.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Se debe pagar una fase de investigación y desarrollo: $19,000</li>
          <li><b>Efecto:</b> Lanza un dado. Si el resultado es par, la venta del próximo movimiento se duplica (+100%). Si es impar, aumentan en un 50%.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-5" class="btn btn-success me-2">Pagar y lanzar dado</button>
          <button id="no-5" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-5').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 19000) {
        jugador.empresa.pagarGastos(19000);
        // Pedir al usuario que ingrese el resultado del dado
        document.getElementById('dialog-container').innerHTML = `
          <div class="alert alert-info">
            Ingresa el resultado de tu dado (1-6):<br>
            <input id="dado-c17" type="number" min="1" max="6" class="form-control w-auto d-inline-block" style="width:80px;display:inline-block;" placeholder="Dado">
            <button id="conf-c17" class="btn btn-primary mt-2">Confirmar</button>
          </div>`;
        document.getElementById('conf-c17').onclick = () => {
          const valor = parseInt(document.getElementById('dado-c17').value);
          if (isNaN(valor) || valor < 1 || valor > 6) {
            alert('Ingresa un valor entre 1 y 6.');
            return;
          }
          clearDialog();
          if (valor % 2 === 0) {
            jugador.empresa.bonificacionVentas = 2.0;
            jugador.empresa.rondasBonificacion = 1;
            showOutput('<strong>¡Dado par!</strong> La venta del próximo movimiento se duplica (+100%).');
          } else {
            jugador.empresa.bonificacionVentas = 1.5;
            jugador.empresa.rondasBonificacion = 1;
            showOutput('<strong>¡Dado impar!</strong> La venta del próximo movimiento aumenta en un 50%.');
          }
          actualizarEmpresaDashboard();
          esperandoDecision = false;
        };
      } else {
        showOutput('<strong>Desarrollo de nuevo producto:</strong> Fondos insuficientes.');
        esperandoDecision = false;
      }
    };
    document.getElementById('no-5').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 6: Casilla 20 - Inversión en Tecnología
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 20: Inversión en Tecnología</strong><br>
        <em>Tu empresa adopta inteligencia artificial para mejorar la productividad.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Requiere invertir $22,000</li>
          <li><b>Efecto:</b> Disminuye el costo de producción en un 15%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-6" class="btn btn-success me-2">Invertir</button>
          <button id="no-6" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-6').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 22000) {
        jugador.empresa.pagarGastos(22000);
        jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.85);
        actualizarEmpresaDashboard();
        showOutput('<strong>Inversión en Tecnología:</strong> Disminuyes el costo de producción en un 15%.');
      } else {
        showOutput('<strong>Inversión en Tecnología:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-6').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },

  // 7: Casilla 23 - Nuevo proveedor de materia prima
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 23: Nuevo proveedor de materia prima</strong><br>
        <em>Has encontrado un proveedor que te ofrece la materia prima a un 5% más bajo.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> N.A</li>
          <li><b>Efecto:</b> Disminuye directamente tu costo de producción en un 5% y aumenta tus ingresos en un 10%.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-7" class="btn btn-success me-2">Aceptar</button>
          <button id="no-7" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-7').onclick = () => {
      clearDialog();
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.95);
      // Aumenta ingresos netos en 10%
      const aumento = Math.floor(jugador.empresa.ingresoNeto * 0.10);
      jugador.empresa.actualizarIngresos(aumento);
      actualizarEmpresaDashboard();
      showOutput('<strong>Nuevo proveedor:</strong> Disminuyes tu costo de producción en un 5% y aumentan tus ingresos en un 10%.');
      esperandoDecision = false;
    };
    document.getElementById('no-7').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 8: Casilla 26 - Participación en feria de emprendimiento (más riesgo)
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 26: Participación en feria de emprendimiento</strong><br>
        <em>Tu empresa fue seleccionada para participar en una feria local. Allí logras nuevos contactos y oportunidades comerciales.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Debes invertir $10,000 en el evento</li>
          <li><b>Efecto:</b> Recibes $18,000 por nuevos clientes, pero lanza un dado: si sale 1 o 2, pagas $5,000 extra por imprevistos; si sale 6, pierdes un turno por agotamiento.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-8" class="btn btn-success me-2">Invertir</button>
          <button id="no-8" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-8').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 10000) {
        jugador.empresa.pagarGastos(10000);
        jugador.empresa.actualizarIngresos(18000);
        document.getElementById('dialog-container').innerHTML = `
          <div class="alert alert-info">
            Lanza un dado (1-6) para ver si tienes gastos imprevistos o pierdes un turno:<br>
            <input id="dado-feria" type="number" min="1" max="6" class="form-control w-auto d-inline-block" style="width:80px;display:inline-block;" placeholder="Dado">
            <button id="conf-feria" class="btn btn-primary mt-2">Confirmar</button>
          </div>`;
        document.getElementById('conf-feria').onclick = () => {
          const val = parseInt(document.getElementById('dado-feria').value);
          clearDialog();
          if (val === 1 || val === 2) {
            jugador.empresa.pagarGastos(5000);
            showOutput('<strong>Feria:</strong> Recibes $18,000 pero pagas $5,000 extra por imprevistos.');
          } else if (val === 6) {
            jugador.turnosPerdidos += 1;
            showOutput('<strong>Feria:</strong> Recibes $18,000 pero pierdes un turno por agotamiento.');
          } else {
            showOutput('<strong>Feria:</strong> Recibes $18,000 por nuevos clientes.');
          }
          actualizarEmpresaDashboard();
          esperandoDecision = false;
        };
      } else {
        showOutput('<strong>Feria:</strong> Fondos insuficientes.');
        esperandoDecision = false;
      }
    };
    document.getElementById('no-8').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },

  // 9: Casilla 29 - Contratación de mentor o asesor experto
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 29: Contratación de mentor o asesor experto</strong><br>
        <em>Un experto en negocios decide apoyarte como mentor. Gracias a sus consejos, logras optimizar procesos clave.</em>
        <ul class="mt-2 mb-2">
          <li><b>Debes pagar honorarios de asesoría:</b> $6,000</li>
          <li><b>Efecto:</b> Disminución de costos de producción en un 10%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-9" class="btn btn-success me-2">Aceptar</button>
          <button id="no-9" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-9').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 6000) {
        jugador.empresa.pagarGastos(6000);
        jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.90);
        actualizarEmpresaDashboard();
        showOutput('<strong>Mentor contratado:</strong> Disminución de costos de producción en un 10%.');
      } else {
        showOutput('<strong>Mentor:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-9').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },

  // 10: Casilla 33 - Inversión en Sustentabilidad
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 33: Inversión en Sustentabilidad</strong><br>
        <em>Tu empresa implementaría prácticas ecológicas que mejoran su reputación.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Requiere una inversión inicial de $45,000</li>
          <li><b>Efecto:</b> Aumenta los ingresos en un 10%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-10" class="btn btn-success me-2">Invertir</button>
          <button id="no-10" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-10').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 45000) {
        jugador.empresa.pagarGastos(45000);
        const inc = Math.floor(jugador.empresa.ingresoNeto * 0.10);
        jugador.empresa.actualizarIngresos(inc);
        actualizarEmpresaDashboard();
        showOutput('<strong>Inversión en Sustentabilidad:</strong> Tus ingresos aumentan en un 10%.');
      } else {
        showOutput('<strong>Inversión en Sustentabilidad:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-10').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },

  // 11: Casilla 36 - Venta del local de tu establecimiento
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 36: Venta del local de tu establecimiento</strong><br>
        <em>El dueño del local comercial en donde se encuentra establecido tu negocio desea venderlo por $52,000. Comprarlo representaría un 50% menos en los gastos operacionales.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Compra del local por $52,000</li>
          <li><b>Efecto:</b> Disminución del 50% en los gastos operacionales</li>
        </ul>
        <div class="mt-3">
          <button id="ok-11" class="btn btn-success me-2">Comprar</button>
          <button id="no-11" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-11').onclick = () => {
      clearDialog();
      if (jugador.empresa.ingresoNeto >= 52000) {
        jugador.empresa.pagarGastos(52000);
        jugador.empresa.gastosOperacionales = Math.floor(jugador.empresa.gastosOperacionales * 0.50);
        actualizarEmpresaDashboard();
        showOutput('<strong>Compra del local:</strong> Disminución del 50% en los gastos operacionales.');
      } else {
        showOutput('<strong>Compra del local:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-11').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },

  // 12: Casilla 39 - Talento Humano Joven
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 39: Talento Humano Joven</strong><br>
        <em>Gran porcentaje de tu empresa mantiene un talento humano joven. El gobierno ha implementado incentivos para empresas que contraten jóvenes, en consecuencia tu costo corporativo baja en un 6% (bonificación).</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> N.A</li>
          <li><b>Efecto:</b> Disminuye en un 6% tus Gastos Operacionales.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-12" class="btn btn-success me-2">Aceptar</button>
          <button id="no-12" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-12').onclick = () => {
      clearDialog();
      jugador.empresa.gastosOperacionales = Math.floor(jugador.empresa.gastosOperacionales * 0.94);
      actualizarEmpresaDashboard();
      showOutput('<strong>Talento Humano Joven:</strong> Disminuye en un 6% tus Gastos Operacionales.');
      esperandoDecision = false;
    };
    document.getElementById('no-12').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 13: Casilla 45 - Aumento de Capital por Inversores (ahora con riesgo)
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 45: Aumento de Capital por Inversores</strong><br>
        <em>Lograste convencer a unos inversores para que aporten capital a cambio de un pequeño porcentaje de tu empresa.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> N.A</li>
          <li><b>Efecto:</b> Lanza un dado: 1-2 los inversores se retiran y pierdes $10,000; 3-6 tu balance aumenta en $30,000.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-13" class="btn btn-success me-2">Aceptar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-13').onclick = () => {
      clearDialog();
      document.getElementById('dialog-container').innerHTML = `
        <div class="alert alert-info">
          Lanza un dado (1-6) para ver si los inversores cumplen:<br>
          <input id="dado-inv" type="number" min="1" max="6" class="form-control w-auto d-inline-block" style="width:80px;display:inline-block;" placeholder="Dado">
          <button id="conf-inv" class="btn btn-primary mt-2">Confirmar</button>
        </div>`;
      document.getElementById('conf-inv').onclick = () => {
        const val = parseInt(document.getElementById('dado-inv').value);
        clearDialog();
        if (val === 1 || val === 2) {
          jugador.empresa.pagarGastos(10000);
          showOutput('<strong>Inversores:</strong> Los inversores se retiran y pierdes $10,000.');
        } else {
          jugador.empresa.ingresoNeto += 30000;
          showOutput('<strong>Aumento de Capital:</strong> Tu balance aumenta en $30,000.');
        }
        actualizarEmpresaDashboard();
        esperandoDecision = false;
      };
    };
  },

  // 14: Casilla 48 - Subvención Gubernamental
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 48: Subvención Gubernamental</strong><br>
        <em>El gobierno otorga una subvención a tu empresa por fomentar el empleo juvenil.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> N.A</li>
          <li><b>Efecto:</b> Recibes $20,000 y tus gastos operacionales disminuyen en un 10% por 3 rondas.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-14" class="btn btn-success me-2">Aceptar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-14').onclick = () => {
      clearDialog();
      jugador.empresa.actualizarIngresos(20000);
      jugador.empresa.gastosOperacionales = Math.floor(jugador.empresa.gastosOperacionales * 0.90);
      jugador.empresa.rondasBonificacion += 3;
      actualizarEmpresaDashboard();
      showOutput('<strong>Subvención Gubernamental:</strong> Recibes $20,000 y tus gastos operacionales disminuyen en un 10% por 3 rondas.');
      esperandoDecision = false;
    };
  },
  // 15: Casilla 49 - Devolución del IVA
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 49: Devolución del IVA</strong><br>
        <em>Se te hace devolución del 10% del IVA pagado en la última etapa.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> N.A</li>
          <li><b>Efecto:</b> Te devuelven 10% del valor pagado en impuestos de la última etapa.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-15" class="btn btn-success me-2">Recibir devolución</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-15').onclick = () => {
      clearDialog();
      // Calcula el IVA pagado en el último movimiento
      // El IVA se calcula sobre el ingreso base del último avance
      const iva = getTramoIVA(jugador.casilla);
      const prev = jugador.casilla - jugador.ultimoDado;
      const ingresoBase = jugador.empresa.calcularIngresoBase(jugador.casilla - prev);
      const ivaPagado = ingresoBase * (iva / 100);
      const devolucion = Math.floor(ivaPagado * 0.10);
      jugador.empresa.actualizarIngresos(devolucion);
      actualizarEmpresaDashboard();
      showOutput(`<strong>Devolución del IVA:</strong> Recibes $${devolucion} (10% del IVA pagado en la última etapa).`);
      esperandoDecision = false;
    };
  },

  // 16: Casilla 52 - Inviertes tus utilidades en acciones de una empresa externa
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 52: Inviertes tus utilidades en acciones de una empresa externa</strong><br>
        <em>Destinas el 60% de tus utilidades a invertir en el mercado de valores. Aunque existe cierto riesgo, la diversificación te brinda un retorno positivo que duplica tus ingresos en las próximas 2 rondas.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Invertir el 60% de tus ingresos</li>
          <li><b>Efecto:</b> Lanza un dado: 1-2 pierdes 20% de los ingresos; 3-6 duplicas los ingresos por 2 rondas.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-16" class="btn btn-success me-2">Invertir y lanzar dado</button>
          <button id="no-16" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-16').onclick = () => {
      clearDialog();
      const inversion = Math.floor(jugador.empresa.ingresoNeto * 0.60);
      if (jugador.empresa.ingresoNeto >= inversion) {
        jugador.empresa.pagarGastos(inversion);
        // Pedir al usuario que ingrese el resultado del dado
        document.getElementById('dialog-container').innerHTML = `
          <div class="alert alert-info">
            Ingresa el resultado de tu dado (1-6):<br>
            <input id="dado-c52" type="number" min="1" max="6" class="form-control w-auto d-inline-block" style="width:80px;display:inline-block;" placeholder="Dado">
            <button id="conf-c52" class="btn btn-primary mt-2">Confirmar</button>
          </div>`;
        document.getElementById('conf-c52').onclick = () => {
          const valor = parseInt(document.getElementById('dado-c52').value);
          if (isNaN(valor) || valor < 1 || valor > 6) {
            alert('Ingresa un valor entre 1 y 6.');
            return;
          }
          clearDialog();
          if (valor === 1 || valor === 2) {
            // Pierde 20% de los ingresos netos actuales
            const perdida = Math.floor(jugador.empresa.ingresoNeto * 0.20);
            jugador.empresa.ingresoNeto -= perdida;
            jugador.empresa.balance -= perdida;
            showOutput('<strong>¡Mala suerte!</strong> Pierdes el 20% de tus ingresos.');
          } else {
            // Duplica ingresos por 2 rondas
            jugador.empresa.bonificacionVentas = 2.0;
            jugador.empresa.rondasBonificacion = 2;
            showOutput('<strong>¡Inversión exitosa!</strong> Duplicas tus ingresos por 2 rondas.');
          }
          actualizarEmpresaDashboard();
          esperandoDecision = false;
        };
      } else {
        showOutput('<strong>Inversión en acciones:</strong> Fondos insuficientes.');
        esperandoDecision = false;
      }
    };
    document.getElementById('no-16').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
];





// --- Efectos para Casillas de Amenaza (índices 0–19) ---
const efectosAmen = [
  // Casilla 3: Inspección Fiscal. Pierdes 2 turnos.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 3: Inspección Fiscal</strong><br>
        <em>Una inspección fiscal inesperada detiene tus operaciones.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes 2 turnos.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-0" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-0').onclick = () => {
      jugador.turnosPerdidos += 2;
      clearDialog();
      showOutput(`<strong>Inspección Fiscal</strong><br>Pierdes 2 turnos.`);
      esperandoDecision = false;
    };
  },
  // Casilla 6: Retraso Logístico. Retrocedes 1 casilla. (panel visual)
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 6: Retraso Logístico</strong><br>
        <em>Un problema inesperado en la cadena de suministro retrasa la entrega de tus productos.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Retrocedes 1 casilla.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-1" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-1').onclick = () => {
      jugador.casilla = Math.max(0, jugador.casilla - 1);
      actualizarTablero();
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Retraso Logístico</strong><br>Retrocedes 1 casilla.`);
      esperandoDecision = false;
    };
  },
  // Casilla 9: Reparación de Maquinaria. Pierdes $10,000 y +5% costo producción. (panel visual)
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 9: Reparación de Maquinaria</strong><br>
        <em>Una avería inesperada en la maquinaria detiene la producción y requiere una costosa reparación.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pagas $10,000 y tu costo de producción aumenta en un 5%.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-2" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-2').onclick = () => {
      if (jugador.empresa.ingresoNeto >= 10000) {
        jugador.empresa.pagarGastos(10000);
        jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.05);
        actualizarEmpresaDashboard();
        clearDialog();
        showOutput(`<strong>Reparación de Maquinaria</strong><br>Pagas $10,000 y costo de producción +5%.`);
      } else {
        clearDialog();
        showOutput(`<strong>Reparación de Maquinaria</strong><br>No tienes $10,000. ¡GAME OVER!`);
        gameOver = true;
      }
      esperandoDecision = false;
    };
  },
  // Casilla 12: Fallo en el Sistema de Ventas. Pierdes 5% de bonificaciones de ventas por 2 rondas.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 12: Fallo en el Sistema de Ventas</strong><br>
        <em>Un fallo en el sistema de ventas afecta tus bonificaciones.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes 5% de bonificaciones de ventas por 2 rondas.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-3" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-3').onclick = () => {
      jugador.empresa.bonificacionVentas *= 0.95;
      jugador.empresa.rondasBonificacion = Math.max(jugador.empresa.rondasBonificacion, 2);
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Fallo en Sistema de Ventas</strong><br>Pierdes 5% de bonificaciones x2 rondas.`);
      esperandoDecision = false;
    };
  },
  // Casilla 15: Paro de Producción. Retrocedes 1 casilla y bonificaciones limitadas por 4 rondas.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 15: Paro de Producción</strong><br>
        <em>Un paro inesperado detiene la producción y limita tus bonificaciones.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Retrocedes 1 casilla y bonificaciones limitadas por 4 rondas.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-4" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-4').onclick = () => {
      jugador.casilla = Math.max(0, jugador.casilla - 1);
      jugador.empresa.limiteBonificaciones = 4;
      actualizarTablero();
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Paro de Producción</strong><br>Retrocedes 1 casilla y bonificaciones limitadas por 4 rondas.`);
      esperandoDecision = false;
    };
  },
  // Casilla 19: Cambio en normativas legales. Lanza el dado; tu costo de producción aumenta un 5% por cada punto
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 19: CAMBIO EN NORMATIVAS LEGALES</strong><br>
        <em>El gobierno aprueba una nueva regulación que afecta tu sector. Debes adaptar urgentemente tu producto a los nuevos requisitos del gobierno.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Lanza el dado; tu costo de producción aumenta un 5% por cada punto.</li>
        </ul>
        <div class="mt-3">
          <input type="number" id="dreg" class="form-control mb-2" min="1" max="6" placeholder="Dado">
          <button id="conf-reg" class="btn btn-danger">Confirmar</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('conf-reg').onclick = () => {
      const v = parseInt(document.getElementById('dreg').value);
      if (isNaN(v) || v < 1 || v > 6) return alert('Ingresa un valor entre 1 y 6.');
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * (1 + 0.05 * v));
      clearDialog();
      actualizarEmpresaDashboard();
      showOutput(`<strong>CAMBIO EN NORMATIVAS LEGALES</strong><br>Costo de producción +${5 * v}%`);
      esperandoDecision = false;
    };
  },
  // Casilla 22: SANCIÓN POR INCUMPLIMIENTO. RETROCEDES 2 CASILLAS Y PIERDES 3 TURNOS
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 22: SANCIÓN POR INCUMPLIMIENTO</strong><br>
        <em>Una entidad reguladora te multa por no cumplir un requerimiento legal.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> RETROCEDES 2 CASILLAS Y PIERDES 3 TURNOS</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-6" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-6').onclick = () => {
      jugador.casilla = Math.max(0, jugador.casilla - 2);
      jugador.turnosPerdidos += 3;
      actualizarTablero();
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>SANCIÓN POR INCUMPLIMIENTO</strong><br>Retrocedes 2 casillas y pierdes 3 turnos.`);
      esperandoDecision = false;
    };
  },
  // Casilla 25: COMPETENCIA DESLEAL. PIERDES 10% DE MARGEN DE GANANCIAS Y TUS INGRESOS DISMINUYEN EN UN 10%
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 25: COMPETENCIA DESLEAL</strong><br>
        <em>Una empresa rival baja precios drásticamente o copia tu producto.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> PIERDES 10% DE MARGEN DE GANANCIAS Y TUS INGRESOS DISMINUYEN EN UN 10%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-7" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-7').onclick = () => {
      jugador.empresa.margenGanancia *= 0.90;
      const ded = Math.floor(jugador.empresa.ingresoNeto * 0.10);
      jugador.empresa.ingresoNeto -= ded;
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>COMPETENCIA DESLEAL</strong><br>Pierdes 10% de margen de ganancias y tus ingresos disminuyen en un 10% (-$${ded}).`);
      esperandoDecision = false;
    };
  },
  // Casilla 28: AUMENTA EL PRECIO DE LA MATERIA PRIMA. AUMENTA TU COSTO DE PRODUCCIÓN EN UN 15%
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 28: AUMENTA EL PRECIO DE LA MATERIA PRIMA</strong><br>
        <em>El precio de tus insumos principales sube. Tus costos se disparan.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> AUMENTA TU COSTO DE PRODUCCIÓN EN UN 15%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-8" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-8').onclick = () => {
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.15);
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>AUMENTA EL PRECIO DE LA MATERIA PRIMA</strong><br>Tu costo de producción aumenta en un 15%.`);
      esperandoDecision = false;
    };
  },
  // Casilla 31: PROBLEMA DE CALIDAD. AUMENTA EN UN 15% TU COSTO DE PRODUCCIÓN T DISMINUYE UN 15% TUS INGRESOS
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 31: PROBLEMA DE CALIDAD</strong><br>
        <em>Un lote sale defectuoso. Recibes devoluciones y quejas de clientes.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> AUMENTA EN UN 15% TU COSTO DE PRODUCCIÓN Y DISMINUYE UN 15% TUS INGRESOS</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-9" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-9').onclick = () => {
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.15);
      const ded = Math.floor(jugador.empresa.ingresoNeto * 0.15);
      jugador.empresa.ingresoNeto -= ded;
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>PROBLEMA DE CALIDAD</strong><br>Tu costo de producción aumenta en un 15% y pierdes 15% de tus ingresos (-$${ded}).`);
      esperandoDecision = false;
    };
  },
  // Casilla 35: INCENDIO EN LA PLANTA. RETROCEDES 3 CASILLAS Y PIERDES 3 TURNOS
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 35: INCENDIO EN LA PLANTA</strong><br>
        <em>Un accidente destruye parte de tu infraestructura. Pérdida material considerable.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> RETROCEDES 3 CASILLAS Y PIERDES 3 TURNOS</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-10" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-10').onclick = () => {
      jugador.casilla = Math.max(0, jugador.casilla - 3);
      jugador.turnosPerdidos += 3;
      actualizarTablero();
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>INCENDIO EN LA PLANTA</strong><br>Retrocedes 3 casillas y pierdes 3 turnos.`);
      esperandoDecision = false;
    };
  },
  // Casilla 38: CIBERATAQUE. PIERDES $80,000 DE INGRESOS
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 38: CIBERATAQUE</strong><br>
        <em>Un exempleado filtra información estratégica.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> PIERDES $80,000 DE INGRESOS</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-11" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-11').onclick = () => {
      if (jugador.empresa.ingresoNeto >= 80000) {
        jugador.empresa.pagarGastos(80000);
        actualizarEmpresaDashboard();
        clearDialog();
        showOutput(`<strong>CIBERATAQUE</strong><br>Pierdes $80,000 de ingresos.`);
      } else {
        clearDialog();
        showOutput(`<strong>CIBERATAQUE</strong><br>No puedes cubrir $80,000. ¡GAME OVER!`);
        gameOver = true;
      }
      esperandoDecision = false;
    };
  },
  // Casilla 41: MAQUINARIA DAÑADA. Lanza un dado. Retrocedes ese número y pagas $12.000 por cada una.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 41: MAQUINARIA DAÑADA</strong><br>
        <em>Uno de los equipos clave ya es obsoleto. Requiere reemplazo urgente.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Lanza un dado. Retrocedes ese número de casillas y pagas $12.000 por cada una como penalización por la reparación y retraso.</li>
        </ul>
        <div class="mt-3">
          <input type="number" id="dav" class="form-control mb-2" min="1" max="6" placeholder="Dado">
          <button id="conf-av" class="btn btn-danger">Confirmar</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('conf-av').onclick = () => {
      const v = parseInt(document.getElementById('dav').value);
      if (isNaN(v) || v < 1 || v > 6) return alert('Ingresa un valor entre 1 y 6.');
      jugador.casilla = Math.max(0, jugador.casilla - v);
      const costo = v * 12000;
      if (!jugador.empresa.pagarGastos(costo)) {
        clearDialog();
        showOutput('No tienes para pagar la reparación. ¡GAME OVER!');
        gameOver = true;
      } else {
        actualizarEmpresaDashboard();
        clearDialog();
        showOutput(`<strong>Maquinaria Dañada</strong><br>Retrocedes ${v} casillas y pagas $${costo}.`);
      }
      actualizarTablero();
      esperandoDecision = false;
    };
  },
  // Casilla 44: PÉRDIDA DE CONTRATO. Pierdes 30% de tus ingresos netos.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 44: PÉRDIDA DE CONTRATO</strong><br>
        <em>Un cliente grande cancela el acuerdo. Disminuyen tus ingresos proyectados.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes 30% de tus ingresos netos.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-14" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-14').onclick = () => {
      const ded = Math.floor(jugador.empresa.ingresoNeto * 0.30);
      jugador.empresa.ingresoNeto -= ded;
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Pérdida de Contrato</strong><br>Pierdes 30% de tus ingresos netos: -$${ded}.`);
      esperandoDecision = false;
    };
  },
  // Casilla 47: AUMENTO DEL SALARIO MÍNIMO. Aumenta tu costo de producción en un 30%.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 47: AUMENTO DEL SALARIO MÍNIMO</strong><br>
        <em>El gobierno decreta un aumento del salario mínimo. Tu estructura de costos laborales se ve afectada.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Aumenta tu costo de producción en un 30%.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-15" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-15').onclick = () => {
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.3);
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Aumento del salario mínimo</strong><br>Tu costo de producción aumenta en un 30%.`);
      esperandoDecision = false;
    };
  },
  // Casilla 51: SOCIO SE RETIRA. Pierdes el 35% de tus ingresos.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 51: SOCIO SE RETIRA</strong><br>
        <em>Un socio se retira y exige su parte de la inversión.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes el 35% de tus ingresos.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-16" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-16').onclick = () => {
      const ded = Math.floor(jugador.empresa.ingresoNeto * 0.35);
      jugador.empresa.ingresoNeto -= ded;
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Socio se retira</strong><br>Pierdes el 35% de tus ingresos: -$${ded}.`);
      esperandoDecision = false;
    };
  },
  // Casilla 54: Cancelación de Campaña. Pierdes 10% de bonificaciones de ventas.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 54: Cancelación de Campaña</strong><br>
        <em>Una campaña importante es cancelada, afectando tus bonificaciones.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes 10% de bonificaciones de ventas.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-17" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-17').onclick = () => {
      jugador.empresa.bonificacionVentas *= 0.90;
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Cancelación de Campaña</strong><br>Pierdes 10% de tus bonificaciones de ventas.`);
      esperandoDecision = false;
    };
  },
  // Casilla 57: REGISTRO DE TU MARCA. Pierdes 40% de tus ingresos y retrocedes 5 casillas.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 57: REGISTRO DE TU MARCA</strong><br>
        <em>No registraste tu marca a tiempo. Una empresa rival lo hace antes que tú. Te exige dejar de usar tu nombre e imagen comercial. Debes rehacer tu identidad de marca y asumir costos legales.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes el 40% de tus ingresos y retrocedes 5 casillas.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-18" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-18').onclick = () => {
      jugador.empresa.ingresoNeto = Math.floor(jugador.empresa.ingresoNeto * 0.6);
      jugador.casilla = Math.max(0, jugador.casilla - 5);
      actualizarTablero();
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Registro de tu marca</strong><br>Pierdes el 40% de tus ingresos y retrocedes 5 casillas.`);
      esperandoDecision = false;
    };
  },
  // Casilla 60: CRISIS MAYOR. Pierdes 2 turnos y retrocedes al inicio de la etapa anterior (parte naranja).
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 60: CRISIS MAYOR</strong><br>
        <em>Evento macroeconómico o geopolítico golpea tu mercado. La demanda cae bruscamente.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes dos turnos y retrocedes al inicio de la etapa anterior (parte naranja).</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-19" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-19').onclick = () => {
      jugador.turnosPerdidos += 2;
      // Buscar el inicio de la etapa anterior (parte naranja)
      // Define aquí las posiciones de inicio de cada etapa naranja
      const etapasNaranja = [0, 16, 32, 48];
      let nuevaCasilla = 0;
      for (let i = etapasNaranja.length - 1; i >= 0; i--) {
        if (etapasNaranja[i] < jugador.casilla) {
          nuevaCasilla = etapasNaranja[i];
          break;
        }
      }
      jugador.casilla = nuevaCasilla;
      actualizarTablero();
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Crisis Mayor</strong><br>Pierdes 2 turnos y retrocedes al inicio de la etapa anterior (parte naranja).`);
      esperandoDecision = false;
    };
  },
  // Casilla 63: DEVALUACIÓN DE ACTIVOS. Pierdes 20% margen de ganancia y 2 turnos.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>CASILLA 63: DEVALUACIÓN DE ACTIVOS</strong><br>
        <em>Por factores externos, tus propiedades inmobiliarias se devalúan rápidamente. Pierdes valor patrimonial.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Pierdes 20% de margen de ganancia y 2 turnos.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-amen-20" class="btn btn-danger">Aceptar efecto</button>
        </div>
      </div>`;
    esperandoDecision = true;
    document.getElementById('ok-amen-20').onclick = () => {
      jugador.empresa.margenGanancia *= 0.8;
      jugador.turnosPerdidos += 2;
      actualizarEmpresaDashboard();
      clearDialog();
      showOutput(`<strong>Devaluación de Activos</strong><br>Pierdes 20% de margen de ganancia y 2 turnos.`);
      esperandoDecision = false;
    };
  }
];

function procesarCasillaOportunidad(cas){esperandoDecision=false;clearDialog();efectosOpp[cas.indiceEfecto]();actualizarEmpresaDashboard();}
function procesarCasillaAmenaza(cas){esperandoDecision=false;clearDialog();efectosAmen[cas.indiceEfecto]();actualizarEmpresaDashboard();}

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('btn-iniciar').addEventListener('click',initJuego);
  document.getElementById('btn-turno').addEventListener('click',turno);

  // Si tienes los botones de dado aleatorio y limpiar log, descomenta estas líneas:
  // document.getElementById('btn-random-dice').addEventListener('click',()=>document.getElementById('dado').value=Math.ceil(Math.random()*6));
  // document.getElementById('btn-clear-log').addEventListener('click',()=>showOutput(''));
});











