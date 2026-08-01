import 'package:hive/hive.dart';

class LocalPlacementRepository {
  final Box _box = Hive.box('placementBox');

  List<String> loadScans(String sessionId) {
    final stored = _box.get('scans_$sessionId') as List<dynamic>?;
    return stored?.cast<String>() ?? [];
  }

  void saveScans(String sessionId, List<String> rolls) {
    _box.put('scans_$sessionId', rolls);
  }

  void clearScans(String sessionId) {
    _box.delete('scans_$sessionId');
  }
}
