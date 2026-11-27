package pe.serpost;

import com.fasterxml.jackson.databind.ObjectMapper;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.List;

/** Cliente de escritorio SERPOST. La persistencia pertenece al servicio remoto. */
public final class App {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static String baseUrl = System.getProperty("serpost.url", "http://localhost:3001");
  private static String token = System.getProperty("serpost.token", "");
  private static final Color NAVY = new Color(18, 47, 82), BLUE = new Color(0, 110, 180), PALE = new Color(244, 248, 251);
  private final JFrame frame = new JFrame("SERPOST | Gestión postal");
  private final JLabel connection = new JLabel();

  public static void main(String[] args) { SwingUtilities.invokeLater(() -> new App().show()); }

  private void show() {
    try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); } catch (Exception ignored) { }
    frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
    frame.setMinimumSize(new Dimension(1000, 680)); frame.setSize(1180, 780); frame.setLocationRelativeTo(null);
    JPanel root = new JPanel(new BorderLayout()); root.setBackground(PALE);
    JPanel header = new JPanel(new BorderLayout()); header.setBackground(NAVY); header.setBorder(new EmptyBorder(12, 18, 12, 18));
    JLabel title = new JLabel("SERPOST  ·  Sistema de gestión postal"); title.setForeground(Color.WHITE); title.setFont(title.getFont().deriveFont(Font.BOLD, 21f));
    JButton settings = new JButton("Conexión al servicio"); settings.addActionListener(e -> configure());
    header.add(title, BorderLayout.WEST); header.add(settings, BorderLayout.EAST);
    JTabbedPane tabs = new JTabbedPane(); tabs.addTab("Clientes", clientsPanel()); tabs.addTab("Envíos", shipmentsPanel()); tabs.addTab("Tarifas y boleta", ratesPanel()); tabs.addTab("Arquitectura", architecturePanel());
    JPanel footer = new JPanel(new BorderLayout()); footer.setBorder(new EmptyBorder(7, 14, 7, 14)); footer.setBackground(Color.WHITE); footer.add(connection, BorderLayout.WEST);
    root.add(header, BorderLayout.NORTH); root.add(tabs, BorderLayout.CENTER); root.add(footer, BorderLayout.SOUTH);
    frame.setContentPane(root); refreshConnection(); frame.setVisible(true);
  }

  private JPanel page(String heading, String subtitle) {
    JPanel p = new JPanel(new BorderLayout(10, 10)); p.setBackground(PALE); p.setBorder(new EmptyBorder(18, 18, 18, 18));
    JPanel intro = new JPanel(new GridLayout(0,1,3,3)); intro.setOpaque(false);
    JLabel h = new JLabel(heading); h.setFont(h.getFont().deriveFont(Font.BOLD, 22f)); h.setForeground(NAVY);
    JLabel s = new JLabel(subtitle); s.setForeground(new Color(87,100,112)); intro.add(h); intro.add(s); p.add(intro, BorderLayout.NORTH); return p;
  }
  private JTextField field(JPanel form, String label, String value) {
    JPanel cell = new JPanel(new BorderLayout(3,4)); cell.setOpaque(false); cell.add(new JLabel(label), BorderLayout.NORTH);
    JTextField input = new JTextField(value, 16); cell.add(input, BorderLayout.CENTER); form.add(cell); return input;
  }
  private JComboBox<String> combo(JPanel form, String label, String... values) {
    JPanel cell = new JPanel(new BorderLayout(3,4)); cell.setOpaque(false); cell.add(new JLabel(label), BorderLayout.NORTH);
    JComboBox<String> input = new JComboBox<>(values); cell.add(input); form.add(cell); return input;
  }
  private JPanel formGrid() { JPanel g = new JPanel(new GridLayout(0,4,10,9)); g.setOpaque(false); return g; }
  private DefaultTableModel model(String... headers) { return new DefaultTableModel(headers,0) { public boolean isCellEditable(int r,int c){return false;} }; }
  private JTable table(DefaultTableModel m) { JTable t = new JTable(m); t.setRowHeight(25); t.setAutoCreateRowSorter(true); return t; }

  private JPanel clientsPanel() {
    JPanel p = page("Clientes", "Registro y mantenimiento mediante el servicio REST compartido con la base de datos.");
    JPanel body = new JPanel(new BorderLayout(10,10)); body.setOpaque(false);
    JPanel form = formGrid(); JComboBox<String> doc = combo(form,"Tipo documento","DNI","RUC","CE");
    JTextField number=field(form,"N° documento",""), names=field(form,"Nombres y apellidos",""), address=field(form,"Dirección",""), phone=field(form,"Teléfono",""), email=field(form,"Correo electrónico","" );
    JComboBox<String> role=combo(form,"Rol","remitente","destinatario");
    DefaultTableModel m=model("ID","Documento","Cliente","Teléfono","Dirección","Correo","Rol"); JTable t=table(m);
    JLabel msg=new JLabel(" "); JPanel controls=new JPanel(new FlowLayout(FlowLayout.LEFT)); controls.setOpaque(false);
    JButton create=new JButton("Registrar"), update=new JButton("Guardar cambios"), delete=new JButton("Eliminar seleccionado"), reload=new JButton("Actualizar lista");
    controls.add(create);controls.add(update);controls.add(delete);controls.add(reload);
    final java.util.List<Map<String,Object>> rows=new ArrayList<>();
    Runnable load=()->runAsync(()->{var data=request("GET","/clientes",null); rows.clear(); rows.addAll(asList(data)); SwingUtilities.invokeLater(()->{m.setRowCount(0); for(var c:rows)m.addRow(new Object[]{shortId(c),val(c,"tipo_documento")+" "+val(c,"numero_documento"),val(c,"nombres"),val(c,"telefono"),val(c,"direccion"),val(c,"correo"),val(c,"rol")});msg.setText("Clientes cargados: "+rows.size());});});
    create.addActionListener(e->runAsync(()->{Map<String,Object> d=map("tipo_documento",doc.getSelectedItem(),"numero_documento",number.getText().trim(),"nombres",names.getText().trim(),"direccion",address.getText().trim(),"telefono",phone.getText().trim(),"correo",email.getText().trim(),"rol",role.getSelectedItem());request("POST","/clientes",d);SwingUtilities.invokeLater(()->{msg.setText("Cliente registrado.");load.run();});}));
    update.addActionListener(e->{int r=t.getSelectedRow();if(r<0){msg.setText("Selecciona un cliente de la tabla.");return;}var c=rows.get(t.convertRowIndexToModel(r));runAsync(()->{Map<String,Object>d=map("tipo_documento",doc.getSelectedItem(),"numero_documento",number.getText().trim(),"nombres",names.getText().trim(),"direccion",address.getText().trim(),"telefono",phone.getText().trim(),"correo",email.getText().trim(),"rol",role.getSelectedItem());request("PUT","/clientes/"+enc(val(c,"id")),d);SwingUtilities.invokeLater(()->{msg.setText("Cliente actualizado.");load.run();});});});
    delete.addActionListener(e->{int r=t.getSelectedRow();if(r<0)return;var c=rows.get(t.convertRowIndexToModel(r));if(confirm("¿Eliminar al cliente seleccionado?"))runAsync(()->{request("DELETE","/clientes/"+enc(val(c,"id")),null);SwingUtilities.invokeLater(()->{msg.setText("Cliente eliminado.");load.run();});});});
    t.getSelectionModel().addListSelectionListener(e->{if(e.getValueIsAdjusting()||t.getSelectedRow()<0)return;var c=rows.get(t.convertRowIndexToModel(t.getSelectedRow()));doc.setSelectedItem(val(c,"tipo_documento"));number.setText(val(c,"numero_documento"));names.setText(val(c,"nombres"));address.setText(val(c,"direccion"));phone.setText(val(c,"telefono"));email.setText(val(c,"correo"));role.setSelectedItem(val(c,"rol"));});
    reload.addActionListener(e->load.run()); body.add(form,BorderLayout.NORTH);body.add(new JScrollPane(t),BorderLayout.CENTER);body.add(controls,BorderLayout.SOUTH);p.add(body,BorderLayout.CENTER);p.add(msg,BorderLayout.SOUTH);load.run();return p;
  }

  private JPanel shipmentsPanel() {
    JPanel p=page("Envíos", "Alta, consulta, avance de estado y eliminación de envíos registrados en el backend.");
    JPanel body=new JPanel(new BorderLayout(10,10));body.setOpaque(false); JPanel form=formGrid();
    JTextField code=field(form,"Código de envío","ENV-"+UUID.randomUUID().toString().substring(0,8).toUpperCase()), sender=field(form,"UUID remitente",""), recipient=field(form,"UUID destinatario",""), origin=field(form,"Origen","Lima Centro 100"), destination=field(form,"Destino",""), weight=field(form,"Peso (kg)","1.5"), content=field(form,"Contenido","" );
    JComboBox<String> line=combo(form,"Línea de negocio","Personal","Empresarial","Encomienda","Filatelia");
    DefaultTableModel m=model("ID","Código","Remitente","Destinatario","Origen","Destino","Peso kg","Estado"); JTable t=table(m); JLabel msg=new JLabel(" "); final List<Map<String,Object>> rows=new ArrayList<>();
    JPanel actions=new JPanel(new FlowLayout(FlowLayout.LEFT));actions.setOpaque(false);JButton add=new JButton("Registrar envío"),advance=new JButton("Avanzar estado"),del=new JButton("Eliminar"),reload=new JButton("Actualizar lista"); for(JButton b:List.of(add,advance,del,reload))actions.add(b);
    Runnable load=()->runAsync(()->{var result=request("GET","/envios",null);rows.clear();rows.addAll(asList(result));SwingUtilities.invokeLater(()->{m.setRowCount(0);for(var x:rows)m.addRow(new Object[]{shortId(x),val(x,"codigo"),val(x,"id_remitente"),val(x,"id_destinatario"),val(x,"origen"),val(x,"destino"),val(x,"peso_kg"),val(x,"estado")});msg.setText("Envíos cargados: "+rows.size());});});
    add.addActionListener(e->{Map<String,Object>d=map("codigo",code.getText().trim(),"id_remitente",sender.getText().trim(),"id_destinatario",recipient.getText().trim(),"origen",origin.getText().trim(),"destino",destination.getText().trim(),"peso_kg",parseWeight(weight.getText()),"contenido",content.getText().trim(),"linea_negocio",line.getSelectedItem(),"estado","REGISTRADO");runAsync(()->{request("POST","/envios",d);SwingUtilities.invokeLater(()->{msg.setText("Envío registrado.");load.run();});});});
    advance.addActionListener(e->{Map<String,Object>x=selected(t,rows);if(x==null)return;String state=val(x,"estado");String next=switch(state){case "REGISTRADO"->"EN_TRANSITO";case "EN_TRANSITO"->"ENTREGADO";default->"REGISTRADO";};runAsync(()->{request("PUT","/envios/"+enc(val(x,"id")),map("estado",next,"simulacion_log","Estado actualizado a "+next));SwingUtilities.invokeLater(()->{msg.setText("Estado cambiado a "+next);load.run();});});});
    del.addActionListener(e->{var x=selected(t,rows);if(x!=null&&confirm("¿Eliminar el envío "+val(x,"codigo")+"?"))runAsync(()->{request("DELETE","/envios/"+enc(val(x,"id")),null);SwingUtilities.invokeLater(()->{msg.setText("Envío eliminado.");load.run();});});});reload.addActionListener(e->load.run());
    body.add(form,BorderLayout.NORTH);body.add(new JScrollPane(t),BorderLayout.CENTER);body.add(actions,BorderLayout.SOUTH);p.add(body,BorderLayout.CENTER);p.add(msg,BorderLayout.SOUTH);load.run();return p;
  }

  private JPanel ratesPanel() {
    JPanel p=page("Tarifas y boleta", "Cotización local, actualización del envío y comprobante de la tarifa aplicada.");
    JPanel box=new JPanel(new GridLayout(0,2,12,10));box.setOpaque(false);box.setBorder(BorderFactory.createEmptyBorder(15,10,15,10));
    JTextField shipmentId=new JTextField(), weight=new JTextField("1.5"), destination=new JTextField(); JComboBox<String> service=new JComboBox<>(new String[]{"ESTANDAR","EXPRESS","CARGO"}),zone=new JComboBox<>(new String[]{"LOCAL","NACIONAL","EXTREMA"});JCheckBox round=new JCheckBox("Ida y vuelta"), tax=new JCheckBox("Incluir IGV (18%)",true);
    box.add(new JLabel("ID de envío"));box.add(shipmentId);box.add(new JLabel("Peso (kg)"));box.add(weight);box.add(new JLabel("Servicio"));box.add(service);box.add(new JLabel("Zona"));box.add(zone);box.add(new JLabel("Destino"));box.add(destination);box.add(round);box.add(tax);
    JTextArea receipt=new JTextArea();receipt.setEditable(false);receipt.setFont(new Font(Font.MONOSPACED,Font.PLAIN,14));JButton quote=new JButton("Calcular tarifa"),apply=new JButton("Aplicar al envío (PUT)");JPanel buttons=new JPanel(new FlowLayout(FlowLayout.LEFT));buttons.add(quote);buttons.add(apply);JLabel msg=new JLabel("Selecciona un envío en la pestaña Envíos y copia su ID.");
    final double[] amount=new double[3]; final double[] currentWeight=new double[1];
    java.util.function.BooleanSupplier calculate=()->{try{double kg=Double.parseDouble(weight.getText().replace(',','.'));if(kg<=0||kg>30)throw new IllegalArgumentException("El peso debe ser mayor que cero y hasta 30 kg.");String s=(String)service.getSelectedItem(),z=(String)zone.getSelectedItem();double base=s.equals("ESTANDAR")?10:s.equals("EXPRESS")?18:25;double per=s.equals("ESTANDAR")?3.5:s.equals("EXPRESS")?6:4.5;double mult=z.equals("LOCAL")?1:z.equals("NACIONAL")?1.25:1.5;amount[0]=Math.round((base+kg*per)*mult*(round.isSelected()?2:1)*100)/100.0;amount[1]=tax.isSelected()?Math.round(amount[0]*.18*100)/100.0:0;amount[2]=amount[0]+amount[1];currentWeight[0]=kg;String ref=UUID.randomUUID().toString().substring(0,8).toUpperCase();receipt.setText("SERPOST — BOLETA DE SERVICIO\n"+"====================================\n"+"Boleta: BOL-"+ref+"\nFecha: "+java.time.LocalDate.now()+"\nEnvío: "+shipmentId.getText()+"\nRuta: "+destination.getText()+"\nServicio: "+s+" / "+z+(round.isSelected()?" / Ida y vuelta":"")+"\nPeso: "+kg+" kg\n\nSubtotal: S/ "+String.format(Locale.US,"%.2f",amount[0])+"\nIGV:      S/ "+String.format(Locale.US,"%.2f",amount[1])+"\nTOTAL:    S/ "+String.format(Locale.US,"%.2f",amount[2])+"\n\nGuía: GUI-"+ref);return true;}catch(Exception ex){message(ex.getMessage());return false;}};
    quote.addActionListener(e->calculate.getAsBoolean()); apply.addActionListener(e->{if(!calculate.getAsBoolean()||shipmentId.getText().isBlank())return;String id=shipmentId.getText().trim();String destinationValue=destination.getText().trim();String selectedService=(String)service.getSelectedItem(),selectedZone=(String)zone.getSelectedItem();boolean roundTrip=round.isSelected();double weightValue=currentWeight[0],totalValue=amount[2];runAsync(()->{Object found=request("GET","/envios/"+enc(id),null);if(!(found instanceof Map<?,?> raw))throw new IllegalStateException("No se encontró el envío indicado.");Map<String,Object> payload=new LinkedHashMap<>((Map<String,Object>)raw);payload.put("peso_kg",weightValue);payload.put("destino",destinationValue.isBlank()?payload.get("destino"):destinationValue);payload.put("servicio",selectedService);payload.put("zona",selectedZone);payload.put("ida_vuelta",roundTrip);payload.put("tarifa_total",totalValue);payload.put("estado","COTIZADO");request("PUT","/envios/"+enc(id),payload);SwingUtilities.invokeLater(()->msg.setText("Tarifa aplicada al envío."));});});
    p.add(box,BorderLayout.NORTH);p.add(new JScrollPane(receipt),BorderLayout.CENTER);p.add(buttons,BorderLayout.WEST);p.add(msg,BorderLayout.SOUTH);return p;
  }

  private JPanel architecturePanel(){JPanel p=page("Arquitectura cliente-servidor", "Diseño para presentación en máquinas físicas, conectadas a la misma red.");JTextArea info=new JTextArea("CLIENTE — Java 25 + Java Swing\nEsta aplicación se ejecuta en la máquina del usuario.\n\nSERVIDOR DE SERVICIOS — backend existente\nConfigure aquí la dirección IP y puerto del backend (por ejemplo http://192.168.1.20:3001).\nEl backend valida las operaciones y se conecta a la base de datos compartida.\n\nSERVIDOR DE BASE DE DATOS — instancia existente\nLa base de datos sigue siendo la que utiliza el backend. El cliente de escritorio no abre conexiones directas a ella.\n\nFlujo: Java Swing → HTTP → servicio backend → base de datos\n\nLa aplicación no requiere navegador ni máquina virtual. Se ejecuta con Java instalado en cada equipo.");info.setEditable(false);info.setFont(new Font(Font.SANS_SERIF,Font.PLAIN,16));info.setBorder(new EmptyBorder(20,20,20,20));p.add(info,BorderLayout.CENTER);return p;}

  private void configure(){JTextField url=new JTextField(baseUrl,32),bearer=new JTextField(token,32);JPanel form=new JPanel(new GridLayout(0,1,5,5));form.add(new JLabel("URL base del servicio backend"));form.add(url);form.add(new JLabel("Token Bearer (si aplica)"));form.add(bearer);if(JOptionPane.showConfirmDialog(frame,form,"Conexión del cliente",JOptionPane.OK_CANCEL_OPTION)==JOptionPane.OK_OPTION){baseUrl=url.getText().trim().replaceAll("/+$","");token=bearer.getText().trim();refreshConnection();}}
  private void refreshConnection(){connection.setText("Servicio: "+baseUrl+"   ·   "+(token.isBlank()?"Sin token configurado":"Token configurado"));}
  private Object request(String method,String path,Object body){try{String url=baseUrl.replaceAll("/+$","")+path;HttpRequest.Builder b=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20)).header("Accept","application/json");if(!token.isBlank())b.header("Authorization","Bearer "+token);if(body==null)b.method(method,HttpRequest.BodyPublishers.noBody());else b.header("Content-Type","application/json; charset=utf-8").method(method,HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body),StandardCharsets.UTF_8));HttpResponse<String> r=HttpClient.newHttpClient().send(b.build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));if(r.statusCode()<200||r.statusCode()>=300)throw new IllegalStateException("HTTP "+r.statusCode()+": "+r.body());if(r.body().isBlank())return null;try{return JSON.readValue(r.body(),Object.class);}catch(Exception ignored){return r.body();}}catch(Exception e){throw new IllegalStateException(e.getMessage(),e);}}
  private void runAsync(Runnable task){new SwingWorker<Void,Void>(){protected Void doInBackground(){task.run();return null;}protected void done(){try{get();}catch(Exception e){message(rootMessage(e));}}}.execute();}
  private static String rootMessage(Exception e){Throwable c=e;while(c.getCause()!=null)c=c.getCause();return c.getMessage()==null?"Error de conexión":c.getMessage();}
  private void message(String text){SwingUtilities.invokeLater(()->JOptionPane.showMessageDialog(frame,text,"SERPOST",JOptionPane.INFORMATION_MESSAGE));}
  private boolean confirm(String text){return JOptionPane.showConfirmDialog(frame,text,"Confirmar",JOptionPane.YES_NO_OPTION)==JOptionPane.YES_OPTION;}
  @SuppressWarnings("unchecked") private static List<Map<String,Object>> asList(Object o){if(o instanceof List<?> l)return (List<Map<String,Object>>)l;return List.of();}
  private static Map<String,Object> map(Object... kv){Map<String,Object>m=new LinkedHashMap<>();for(int i=0;i<kv.length;i+=2)m.put((String)kv[i],kv[i+1]);return m;}
  private static String val(Map<String,Object>m,String k){Object v=m.get(k);return v==null?"":String.valueOf(v);}
  private static String shortId(Map<String,Object>m){String id=val(m,"id");return id.length()>10?id.substring(0,8)+"…":id;}
  private static String enc(String s){return java.net.URLEncoder.encode(s,StandardCharsets.UTF_8);}
  private static double parseWeight(String s){return Double.parseDouble(s.trim().replace(',','.'));}
  private static Map<String,Object> selected(JTable t,List<Map<String,Object>> rows){int r=t.getSelectedRow();return r<0?null:rows.get(t.convertRowIndexToModel(r));}
}
