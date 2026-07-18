import 'package:flutter/material.dart';

/// App-wide RouteObserver. Register it in MaterialApp.navigatorObservers.
/// Screens can mix in RouteAware and subscribe to get didPopNext callbacks.
final RouteObserver<ModalRoute<void>> appRouteObserver =
    RouteObserver<ModalRoute<void>>();
