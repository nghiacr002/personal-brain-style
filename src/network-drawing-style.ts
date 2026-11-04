import {BrainDB} from './database.ts';
import {visualDrawingPrompt} from './drawing-styles.ts';

// One-time user-requested selection for existing projects; later deselection is respected.
export function installNetworkDrawingStyle(db:BrainDB){
 const marker='shared_network_drawing_v1';
 if(db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(marker))return 0;
 const domain='network-architecture',tag='shared-network-architecture-drawing';
 if(!db.hasDomain(domain))db.saveDomain('Network architecture');
 const existing=db.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId') IS NULL AND EXISTS (SELECT 1 FROM json_each(records.snapshot,'$.tags') WHERE value=?)").get(tag) as {snapshot:string}|undefined;
 const style=existing?JSON.parse(existing.snapshot):db.create({
  kind:'preference',domain,title:'Network architecture — topology, boundaries and traffic flows',
  summary:'Editable network views with explicit environments, network boundaries, verified service icons and traceable traffic paths.',
  useWhen:'Drawing or reviewing network architecture, topology, connectivity, hub-and-spoke, VNet/VPC, subnets, private endpoints, routing, firewall, DNS, hybrid or multi-environment deployment diagrams.',
  tags:[tag,'network','topology','connectivity','hub-spoke','vnet','vpc','subnet','firewall','routing','dns','private endpoint','hybrid','drawio','deployment'],
  content:`Apply only to network architecture tasks. Deliver native editable .drawio with real nodes and connectors unless the user explicitly requests another format. Read drawio-skill before authoring. Use verified provider icons with nearby service names; preserve official icon geometry. Use neutral icons for vendor-neutral components. This style does not select Azure, mandate hub-and-spoke, or impose an application UI palette.

Compose the overview like the supplied reference: external users, sites and third parties at the edge; shared connectivity services together; environment or region groups arranged consistently; repeated workload blocks aligned with the same internal order. Use square containers, restrained category colors, short labels and a notation legend. Preserve logical grouping without copying the reference's tiny text, dense crossings, resource names, addresses or topology into unrelated projects.

Declare whether each view is logical topology, physical connectivity or deployment, and identify environment, region, scope and evidence date. Use an overview for cross-environment relationships and separate readable detail pages for each environment or complex traffic path. Do not combine physical links, application messages and policy rules under one unexplained arrow style. C4 deployment conventions and provider reference architectures guide the notation; do not claim certification against a universal diagram standard.

Distinguish administrative ownership (tenant/account/subscription/resource group), network containment (VNet/VPC/subnet), availability zones and trust/security boundaries. These are different relationships: do not force them into a false nesting tree. Show actual CIDRs, VLANs and network identifiers only when known and appropriate to the detail level. Verify subnet containment and overlaps from configuration; label unknowns rather than guessing. Separate production and nonproduction clearly without implying isolation solely from their position or color.

Represent routers, gateways, firewalls, WAFs, load balancers, VPN/ExpressRoute or equivalent links, peering, DNS/resolvers, NAT/egress and private endpoints where relevant and evidenced. Trace north-south and east-west paths through their actual controls. Distinguish a private endpoint from outbound service network integration and from the managed service itself. Do not place PaaS inside a subnet merely because it has private access. For Azure, peering is not transitive; never imply spoke reachability or firewall inspection without the routing configuration to support it. Show DNS resolution and return paths in detail views when material to connectivity.

Label traffic edges with purpose plus protocol/port when verified. Define whether arrows indicate traffic initiation, message direction or bidirectional connectivity. Use distinct labelled notation for peering, private links, data paths and management/telemetry. Avoid crossing nodes and avoid giant all-to-all connector meshes. Give complex flows stable IDs linking to a compact source/destination/protocol/port/purpose/control/evidence matrix. The matrix supplements visible topology; it does not replace it. Unknown ports or allow rules stay pending. Do not imply that drawn connectivity is permitted, deployed or tested.

Show shared security, identity and observability services as nodes in the appropriate view. Keep only concise labels and key properties on nodes; longer assumptions and explanations go in notes or linked documents. Include a legend for boundary types, symbols and edge meanings. Use pages/layers for detail, and ensure every requested exported page is understandable independently. For failover, redundant paths and security controls, distinguish verified current state from proposed design.

Before delivery validate native XML and connector references, compare topology and traffic rules with the supplied source, and inspect every rendered page at its intended reading size. Check icon rendering, labels, crossings, boundaries and legends. Report structural, semantic and visual verification separately; unavailable rendering or connectivity validation remains Not verified.

References:
https://c4model.com/diagrams/deployment
https://c4model.com/diagrams/notation
https://learn.microsoft.com/en-us/azure/architecture/networking/architecture/hub-spoke
https://learn.microsoft.com/en-us/azure/architecture/icons/

${visualDrawingPrompt}`,
  principles:['Separate ownership, network containment and trust boundaries.','Show evidence-backed traffic paths, not assumed reachability.','Use aligned environment/workload groups and readable overview/detail views.','Preserve native editable diagrams and verify semantics as well as rendering.'],
  externalSkills:['drawio-skill'],requiredIds:[],
  examples:['Hybrid overview: on-premises site → verified VPN/ExpressRoute gateway → connectivity hub, with separately labelled production and nonproduction spokes. Show actual peering and route-controlled traffic independently; do not infer spoke-to-spoke connectivity.','Private service detail: workload → private endpoint → managed database, with a separate DNS-resolution path where verified. Show the endpoint subnet and outbound integration subnet separately; place the managed database according to its actual hosting semantics.','Large estate: one overview plus Production and Nonproduction detail pages. Repeat the same ingress, application, endpoint and data layout for each workload. Flow F01 links to the traffic matrix with verified source, target, protocol, port, purpose and evidence.'],
  reviewCriteria:['Trace every network, CIDR, service and connection to supplied configuration or clearly label it proposed/unknown.','Verify ownership boundaries differ from network and trust boundaries; check subnet containment and address overlaps.','Verify ingress, egress, routing, DNS and return paths where applicable; reject assumed transitive peering or unproven isolation.','Check private endpoints, service integration and managed-service placement accurately represent the platform.','Check flow labels and traffic matrix agree; unknown ports, firewall rules and reachability remain unverified.','Inspect every page at intended reading size for readable labels, aligned groups, crossings, legends and correct official icons.','Verify editable .drawio delivery and report structural, semantic, rendered and connectivity checks separately.'],
  requirements:[{id:'req-network-source',type:'artifact',label:'Editable native network architecture diagram',extension:'.drawio'}],
  priority:90,status:'active',checks:[],backend:null
 });
 let attached=0;
 for(const project of db.projects()){
  if(project.assignments.some(a=>a.recordId===style.id))continue;
  db.saveProject({...project,assignments:[...project.assignments,{recordId:style.id,override:null}]},project.id,project.version);
  attached++;
 }
 db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(marker,'1');
 return attached;
}
